/**
 * Real-browser e2e for the collab spike: IME composition + paste convergence.
 *
 * Validates the messy mutation paths that happy-dom can't exercise — genuine
 * IME composition (driven via Chromium CDP Input.imeSetComposition) and a
 * clipboard paste through the editor's sanitizer. Self-contained: starts a
 * static server, drives system Chrome, tears both down, exits non-zero on
 * failure. Requires Google Chrome installed.
 *
 *   npm run test:e2e
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4173;
const URL = `http://localhost:${PORT}/examples/collab`;
const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

const server = spawn('npx', ['--yes', 'serve', '.', '-p', String(PORT)], { stdio: 'ignore' });

async function waitUp() {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(URL)).ok) return; } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error('static server did not start');
}

let browser;
try {
  await waitUp();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(700);

  const A = '#editorA .rune-content', B = '#editorB .rune-content';
  const txt = (s, i) => page.$eval(s, (e, i) => e.querySelectorAll('p')[i]?.textContent, i);
  const html = (s) => page.$eval(s, (e) => e.innerHTML);

  await page.evaluate(() => {
    const c = document.querySelector('#editorA .rune-content');
    c.innerHTML = '<p>start </p><p>second</p>';
    c.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(150);

  // ── IME: real composition via CDP, with a concurrent remote edit mid-compose ──
  await page.click(A);
  await page.evaluate(() => {
    const p = document.querySelectorAll('#editorA .rune-content p')[0];
    const r = document.createRange(); r.setStart(p.firstChild, p.firstChild.length); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await cdp.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 });
  await cdp.send('Input.imeSetComposition', { text: 'nihao', selectionStart: 5, selectionEnd: 5 });
  await page.evaluate(() => {
    const p = document.querySelectorAll('#editorB .rune-content p')[1];
    p.textContent = 'SECOND';
    document.querySelector('#editorB .rune-content').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(80);
  ok((await txt(A, 0)).includes('ni'), 'IME: composition not corrupted by a concurrent remote edit');
  ok((await txt(A, 1)) === 'second', 'IME: remote patch deferred during composition');
  await cdp.send('Input.insertText', { text: '你好' });
  await sleep(150);
  ok((await txt(A, 0)).includes('你好'), 'IME: composed text committed on compositionend');
  ok((await txt(A, 1)) === 'SECOND', 'IME: deferred remote applied after composition');
  ok((await html(A)) === (await html(B)), 'IME: A and B converged');

  // ── Paste: in-scope rich content syncs (model converges; B keeps local repr) ──
  await page.click(B);
  await page.evaluate(() => {
    const c = document.querySelector('#editorB .rune-content');
    const p = c.querySelectorAll('p')[0];
    const r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const dt = new DataTransfer(); dt.setData('text/html', '<b>pasted</b> text');
    c.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await sleep(200);
  ok(/pasted/.test(await html(B)), 'paste: rich content inserted into B');
  ok(/<strong>pasted<\/strong>/.test(await html(A)), 'paste: bold synced to A via the model');

  // ── Paste: dangerous payload is stripped at the sanitizer boundary ──
  await page.evaluate(() => {
    const c = document.querySelector('#editorB .rune-content');
    const p = c.querySelectorAll('p')[0];
    const r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const dt = new DataTransfer(); dt.setData('text/html', '<img src=x onerror=alert(1)>safe');
    c.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await sleep(150);
  ok(!/onerror/.test(await html(B)), 'paste: dangerous event handler stripped');

  // ── A peer edits the block being composed in (#189) ──
  const setBlock = (h) => page.evaluate((h) => {
    const c = document.querySelector('#editorA .rune-content');
    c.innerHTML = h;
    c.dispatchEvent(new Event('input', { bubbles: true }));
  }, h);
  const caretA = (off) => page.evaluate((off) => {
    const c = document.querySelector('#editorA .rune-content');
    const t = c.querySelector('p').firstChild;
    const r = document.createRange(); r.setStart(t, off); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); c.focus();
  }, off);
  const peerEdit = (fn) => page.evaluate((fn) => {
    const c = document.querySelector('#editorB .rune-content');
    const t = c.querySelector('p').firstChild;
    t.data = fn === 'before' ? 'PEER ' + t.data : t.data + ' PEER';
    c.dispatchEvent(new Event('input', { bubbles: true }));
  }, fn);
  const plain = (h) => h.replace(/ data-id="[^"]*"/g, '');

  await setBlock('<p>hello</p>'); await sleep(150);
  await caretA(5);
  await cdp.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 });
  await sleep(40);
  await peerEdit('before');
  await sleep(100);
  await cdp.send('Input.insertText', { text: '你' });
  await sleep(200);
  ok(plain(await html(A)) === '<p>PEER hello你</p>', `same block: a peer's text before the composition survives in A (got ${plain(await html(A))})`);
  ok(plain(await html(B)) === '<p>PEER hello你</p>', `same block: and in B (got ${plain(await html(B))})`);
  await page.keyboard.type('Z');
  await sleep(150);
  ok(plain(await html(B)) === '<p>PEER hello你Z</p>', `same block: typing continues after the composed text (got ${plain(await html(B))})`);

  await setBlock('<p>hello</p>'); await sleep(150);
  await caretA(2);
  await cdp.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 });
  await sleep(40);
  await peerEdit('after');
  await sleep(100);
  await cdp.send('Input.insertText', { text: '你' });
  await sleep(200);
  ok(plain(await html(A)) === '<p>he你llo PEER</p>', `same block: a peer's text after the composition survives (got ${plain(await html(A))})`);
  ok(plain(await html(B)) === '<p>he你llo PEER</p>', `same block: and in B (got ${plain(await html(B))})`);

  await setBlock('<p>hello world</p>'); await sleep(150);
  await page.evaluate(() => {
    const c = document.querySelector('#editorA .rune-content');
    const t = c.querySelector('p').firstChild;
    const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 5);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); c.focus();
  });
  await cdp.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 });
  await sleep(40);
  await peerEdit('after');
  await sleep(100);
  await cdp.send('Input.insertText', { text: '你' });
  await sleep(200);
  ok(plain(await html(B)) === '<p>你 world PEER</p>', `same block: composing over a selection replaces only it (got ${plain(await html(B))})`);

  // ── Line breaks (#187): real keys, because the DOM Chrome builds is the hard part ──
  const setA = (h) => page.evaluate((h) => {
    const c = document.querySelector('#editorA .rune-content');
    c.innerHTML = h;
    c.dispatchEvent(new Event('input', { bubbles: true }));
  }, h);
  const clean = (h) => h.replace(/ data-id="[^"]*"/g, '');
  const caretEnd = (sel) => page.evaluate((sel) => {
    const c = document.querySelector(sel);
    const p = c.querySelector('p');
    const r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); c.focus();
  }, sel);

  await setA('<p>one</p>'); await sleep(150);
  await caretEnd(A);
  await page.keyboard.press('Shift+Enter');
  await sleep(100);
  ok(clean(await html(B)) === '<p>one<br><br></p>', `breaks: a break at the end of a line reaches B (got ${clean(await html(B))})`);
  await page.keyboard.type('two');
  await sleep(150);
  ok(clean(await html(A)) === '<p>one<br>two</p>', `breaks: typing continues on the new line in A (got ${clean(await html(A))})`);
  ok(clean(await html(B)) === '<p>one<br>two</p>', `breaks: B sees both lines (got ${clean(await html(B))})`);

  await caretEnd(B);
  await page.keyboard.type('!');
  await sleep(150);
  ok(clean(await html(A)) === '<p>one<br>two!</p>', `breaks: the break survives B typing (got ${clean(await html(A))})`);
  ok(clean(await html(B)) === '<p>one<br>two!</p>', `breaks: B keeps the break too (got ${clean(await html(B))})`);

  // A break in the middle of a line.
  await setA('<p>onetwo</p>'); await sleep(150);
  await page.evaluate(() => {
    const c = document.querySelector('#editorA .rune-content');
    const t = c.querySelector('p').firstChild;
    const r = document.createRange(); r.setStart(t, 3); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); c.focus();
  });
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('X');
  await sleep(150);
  ok(clean(await html(B)) === '<p>one<br>Xtwo</p>', `breaks: a break mid-line keeps the caret after it (got ${clean(await html(B))})`);

  // A's caret stays on its line while B edits the line above.
  await setA('<p>top<br>bottom</p>'); await sleep(150);
  await caretEnd(A);
  await page.evaluate(() => {
    const c = document.querySelector('#editorB .rune-content');
    const t = c.querySelector('p').firstChild;
    t.data = 'TOP!';
    c.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(150);
  await page.keyboard.type('Z');
  await sleep(150);
  ok(clean(await html(A)) === '<p>TOP!<br>bottomZ</p>', `breaks: the caret stays on its line through a remote edit (got ${clean(await html(A))})`);
  ok(clean(await html(B)) === '<p>TOP!<br>bottomZ</p>', `breaks: B converges (got ${clean(await html(B))})`);

  // Backspace removes a break again.
  await setA('<p>one<br>two</p>'); await sleep(150);
  await page.evaluate(() => {
    const c = document.querySelector('#editorA .rune-content');
    const t = c.querySelector('p').lastChild;
    const r = document.createRange(); r.setStart(t, 0); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); c.focus();
  });
  await page.keyboard.press('Backspace');
  await sleep(150);
  ok(clean(await html(B)) === '<p>onetwo</p>', `breaks: Backspace removes a break for both (got ${clean(await html(B))})`);
} catch (e) {
  fails.push('exception: ' + e.message);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

console.log(fails.length ? `\n${fails.length} failure(s)` : '\nall e2e checks passed');
fails.forEach((f) => console.log('  - ' + f));
process.exit(fails.length ? 1 : 0);
