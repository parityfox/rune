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
} catch (e) {
  fails.push('exception: ' + e.message);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

console.log(fails.length ? `\n${fails.length} failure(s)` : '\nall suggestion checks passed');
process.exit(fails.length ? 1 : 0);
