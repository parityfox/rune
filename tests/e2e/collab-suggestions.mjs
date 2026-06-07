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
} catch (e) {
  fails.push('exception: ' + e.message);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

console.log(fails.length ? `\n${fails.length} failure(s)` : '\nall suggestion checks passed');
process.exit(fails.length ? 1 : 0);
