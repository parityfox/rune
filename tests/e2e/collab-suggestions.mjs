/**
 * Real-browser e2e for suggestion mode (#15): typing becomes tracked changes,
 * accept/reject resolves them. Self-contained (starts/stops its own server);
 * requires Google Chrome. Runs under `npm run test:e2e`.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4175;
const URL = `http://localhost:${PORT}/examples/collab`;
const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

const server = spawn('npx', ['--yes', 'serve', '.', '-p', String(PORT)], { stdio: 'ignore' });
async function waitUp() {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(URL)).ok) return; } catch { /* not up */ } await sleep(300); }
  throw new Error('static server did not start');
}

let browser;
try {
  await waitUp();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
  const A = '#editorA .rune-content', B = '#editorB .rune-content';
  const html = (s) => page.$eval(s, (e) => e.innerHTML);
  const text = (s) => page.$eval(s, (e) => e.textContent);
  const setCaret = (sel, off) => page.evaluate(({ sel, off }) => {
    const c = document.querySelector(sel); const t = c.querySelector('p').firstChild;
    const r = document.createRange(); r.setStart(t, off); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); c.focus();
  }, { sel, off });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(700);
  await page.click('#clearLocal');
  await page.waitForLoadState('networkidle');
  await sleep(700);
  await page.evaluate(() => {
    const c = document.querySelector('#editorA .rune-content');
    c.innerHTML = '<p>hello</p>';
    c.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(150);

  await page.click('#toggleSuggest');        // enable (focus moves to the button)
  await setCaret(A, 5);                       // re-focus editor, caret at end of "hello"
  await page.keyboard.type('NEW');
  await sleep(200);
  ok(/rune-suggestion--insert/.test(await html(A)) && /NEW/.test(await html(A)), 'suggest: typing becomes a tracked insertion');
  ok(/rune-suggestion--insert/.test(await html(B)), 'suggest: tracked insertion syncs to the other peer');

  await setCaret(A, 3);                       // caret inside the original "hello"
  await page.keyboard.press('Backspace');
  await sleep(200);
  ok(/rune-suggestion--delete/.test(await html(A)) && /hello/.test(await text(A)), 'suggest: backspace marks a deletion (text kept)');
  ok((await page.$$eval('#suggestions button', (e) => e.length)) > 0, 'suggest: review panel shows accept/reject controls');

  await page.evaluate(() => { [...document.querySelectorAll('#suggestions button')].find((b) => b.textContent === 'Accept all')?.click(); });
  await sleep(200);
  const t = await text(A);
  ok(!/rune-suggestion/.test(await html(A)), 'suggest: accept-all clears the tracked-change marks');
  ok(/NEW/.test(t) && t.indexOf('hello') === -1, 'suggest: accepted insertion kept, accepted deletion removed');

  // #20: paste in suggest mode -> tracked insertion (marks preserved, danger stripped)
  await page.evaluate(() => {
    const c = document.querySelector('#editorA .rune-content'); const p = c.querySelector('p');
    const t = [...p.childNodes].reverse().find((n) => n.nodeType === 3) || p.firstChild;
    const r = document.createRange(); r.setStart(t, t.length); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); c.focus();
    const dt = new DataTransfer(); dt.setData('text/html', '<b>pasted</b><img src=x onerror=alert(1)>');
    c.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await sleep(250);
  const ah = await html(A);
  ok(/rune-suggestion--insert/.test(ah) && /pasted/.test(ah), 'suggest: paste recorded as a tracked insertion');
  ok(/<strong>pasted<\/strong>/.test(ah), 'suggest: pasted inline formatting (bold) preserved');
  ok(!/onerror/.test(ah), 'suggest: dangerous pasted content stripped');

  // #19: range operations (suggesting still on)
  const reset = (h) => page.evaluate((h) => {
    const c = document.querySelector('#editorA .rune-content'); c.innerHTML = h;
    c.dispatchEvent(new Event('input', { bubbles: true }));
  }, h);
  const selectRange = (a, z) => page.evaluate(({ a, z }) => {
    const c = document.querySelector('#editorA .rune-content'); const t = c.querySelector('p').firstChild;
    const r = document.createRange(); r.setStart(t, a); r.setEnd(t, z);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); c.focus();
  }, { a, z });

  await reset('<p>abcdef</p>'); await sleep(150);
  await selectRange(2, 4);                    // "cd"
  await page.keyboard.type('X');
  await sleep(200);
  let rh = await html(A); let rt = await text(A);
  ok(/rune-suggestion--delete/.test(rh) && /rune-suggestion--insert/.test(rh), 'suggest(range): typing over a selection marks delete + inserts new');
  ok(rt.includes('cd') && rt.includes('X'), 'suggest(range): replaced text kept (struck) and new text inserted');

  await reset('<p>hello world</p>'); await sleep(150);
  await selectRange(6, 11);                   // "world"
  await page.keyboard.press('Backspace');
  await sleep(200);
  ok(/rune-suggestion--delete/.test(await html(A)) && (await text(A)).includes('world'), 'suggest(range): Backspace on a selection marks it deleted (text kept)');

  // Forward Delete with the real key: the browser's inputType must reach the mode.
  await reset('<p>hello world</p>'); await sleep(150);
  await page.evaluate((sel) => {
    const t = document.querySelector(sel + ' p').firstChild;
    const r = document.createRange(); r.setStart(t, 0); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.querySelector(sel).focus();
  }, A);
  await page.keyboard.press('Delete');
  await sleep(100);
  ok(/rune-suggestion--delete/.test(await html(A)) && (await text(A)).startsWith('hello'), 'suggest: Delete marks the next character (text kept)');

  // Pasting over a selection, through the real clipboard event.
  await reset('<p>hello world</p>'); await sleep(150);
  await page.evaluate((sel) => {
    const t = document.querySelector(sel + ' p').firstChild;
    const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 5);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.querySelector(sel).focus();
    const dt = new DataTransfer(); dt.setData('text/plain', 'PASTED');
    document.querySelector(sel).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, A);
  await sleep(100);
  const pasted = await html(A);
  ok(/rune-suggestion--delete/.test(pasted) && /rune-suggestion--insert/.test(pasted) && (await text(A)).includes('hello') && (await text(A)).includes('PASTED'), 'suggest: paste over a selection is tracked');

  // Word and line deletes with the real keys: the input type and range come from the browser.
  const mac = process.platform === 'darwin';
  const caretAt = (off, block = 0) => page.evaluate(({ off, block }) => {
    const c = document.querySelector('#editorA .rune-content');
    const t = c.querySelectorAll('p')[block].firstChild;
    const r = document.createRange(); r.setStart(t, off); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); c.focus();
  }, { off, block });
  const delText = () => page.evaluate(() => [...document.querySelectorAll('#editorA .rune-suggestion--delete')].map((e) => e.textContent).join('|'));

  await reset('<p>hello big world</p>'); await sleep(150);
  await caretAt(9);
  await page.keyboard.press(mac ? 'Alt+Backspace' : 'Control+Backspace');
  await sleep(100);
  ok((await delText()) === 'big' && (await text(A)).includes('hello big world'), `suggest: word delete backward is tracked (marked "${await delText()}")`);

  if (mac) {                                   // Linux has no default binding for these
    await reset('<p>hello big world</p>'); await sleep(150);
    await caretAt(6);
    await page.keyboard.press('Alt+Delete');
    await sleep(100);
    ok((await delText()).trim() === 'big', `suggest: word delete forward is tracked (marked "${await delText()}")`);

    await reset('<p>hello big world</p>'); await sleep(150);
    await caretAt(9);
    await page.keyboard.press('Meta+Backspace');
    await sleep(100);
    ok((await delText()) === 'hello big' && (await text(A)).includes('hello big world'), `suggest: line delete is tracked (marked "${await delText()}")`);
  }

  await reset('<p>one</p><p>two</p>'); await sleep(150);
  await caretAt(0, 1);
  await page.keyboard.press(mac ? 'Alt+Backspace' : 'Control+Backspace');
  await sleep(100);
  const merged = await page.evaluate(() => document.querySelectorAll('#editorA .rune-content p').length);
  ok(merged === 2, `suggest: a word delete at a block's start does not merge blocks (got ${merged} blocks)`);

  // Enter is untracked by design, but must not lose text or existing suggestions.
  await reset('<p>hello</p>'); await sleep(150);
  await caretAt(5);
  await page.keyboard.type('X');
  await sleep(60);
  await caretAt(2);
  await page.keyboard.press('Enter');
  await sleep(150);
  const afterEnter = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('#editorA .rune-content p')].map((p) => p.textContent);
    const peer = [...document.querySelectorAll('#editorB .rune-content p')].map((p) => p.textContent);
    return { ps, peer, marked: !!document.querySelector('#editorA .rune-suggestion--insert') };
  });
  ok(afterEnter.ps.join('|') === 'he|lloX', `suggest: Enter splits the block without losing text (got ${afterEnter.ps.join('|')})`);
  ok(afterEnter.marked, 'suggest: Enter keeps an existing suggestion');
  ok(afterEnter.peer.join('|') === 'he|lloX', `suggest: the split reaches the other peer (got ${afterEnter.peer.join('|')})`);

  // IME with a real composition via CDP: it can't be cancelled, so it's tracked on commit.
  const cdp = await page.context().newCDPSession(page);
  const insText = () => page.evaluate(() => [...document.querySelectorAll('#editorA .rune-suggestion--insert')].map((e) => e.textContent).join('|'));
  const insTextB = () => page.evaluate(() => [...document.querySelectorAll('#editorB .rune-suggestion--insert')].map((e) => e.textContent).join('|'));

  await reset('<p>hello</p>'); await sleep(150);
  await caretAt(5);
  await cdp.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 });
  await cdp.send('Input.imeSetComposition', { text: 'nihao', selectionStart: 5, selectionEnd: 5 });
  await sleep(60);
  await cdp.send('Input.insertText', { text: '你好' });
  await sleep(200);
  ok((await insText()) === '你好', `suggest: IME text is a tracked insertion (marked "${await insText()}")`);
  ok((await insTextB()) === '你好', `suggest: the tracked IME text reaches the other peer (marked "${await insTextB()}")`);
  ok((await text(A)).trim() === 'hello你好', `suggest: IME leaves the right text (got "${await text(A)}")`);
  await page.keyboard.type('X');
  await sleep(150);
  ok((await text(A)).trim() === 'hello你好X' && (await insText()) === '你好X', `suggest: typing continues after the composed text (got "${await text(A)}", marked "${await insText()}")`);

  await reset('<p>hello</p>'); await sleep(150);
  await selectRange(0, 2);
  await cdp.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 });
  await sleep(60);
  await cdp.send('Input.insertText', { text: '你' });
  await sleep(200);
  ok((await delText()) === 'he' && (await insText()) === '你' && (await text(A)).trim() === 'he你llo', `suggest: IME over a selection is tracked (got "${await text(A)}", deleted "${await delText()}", inserted "${await insText()}")`);

  // Drop at a real point.
  await reset('<p>one two</p>'); await sleep(150);
  await caretAt(7);
  await page.evaluate(() => {
    const c = document.querySelector('#editorA .rune-content');
    const t = c.querySelector('p').firstChild;
    const m = document.createRange(); m.setStart(t, 3); m.collapse(true);
    const rect = m.getBoundingClientRect();
    const dt = new DataTransfer(); dt.setData('text/html', 'DROP<img src=x onerror="window.pwned=1">');
    c.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: rect.left, clientY: rect.top + rect.height / 2 }));
  });
  await sleep(150);
  ok((await insText()) === 'DROP' && (await text(A)).trim() === 'oneDROP two', `suggest: a drop is tracked at the drop point (got "${await text(A)}", marked "${await insText()}")`);
  ok(await page.evaluate(() => !window.pwned && !document.querySelector('#editorA .rune-content').innerHTML.includes('onerror')), 'suggest: a tracked drop is sanitized');
} catch (e) {
  fails.push('exception: ' + e.message);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

console.log(fails.length ? `\n${fails.length} failure(s)` : '\nall suggestion checks passed');
process.exit(fails.length ? 1 : 0);
