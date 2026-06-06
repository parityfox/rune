/**
 * Real-browser e2e for local-first persistence (#13): typed content survives a
 * page reload via IndexedDB. Self-contained (starts/stops its own server);
 * requires Google Chrome. `npm run test:e2e` runs this after the IME e2e.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4174;
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
  const ctx = await browser.newContext();        // one context => IndexedDB persists across reloads
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(800);

  // start from a clean local store
  await page.click('#clearLocal');
  await page.waitForLoadState('networkidle');
  await sleep(700);

  // type a unique marker, let y-indexeddb persist it
  await page.click('#editorA .rune-content');
  await page.keyboard.press('End');
  const marker = 'PERSIST' + Date.now();
  await page.keyboard.type(' ' + marker);
  await sleep(1300);

  // reload — content should come back from IndexedDB
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1000);

  const html = await page.$eval('#editorA .rune-content', (e) => e.innerHTML);
  ok(html.includes(marker), 'persistence: typed content survives a page reload');
  ok(/Restored/.test(await page.$eval('#saved', (e) => e.textContent)), 'persistence: status reports restored-from-browser');

  // and it propagated to the second editor on reload too
  const htmlB = await page.$eval('#editorB .rune-content', (e) => e.innerHTML);
  ok(htmlB.includes(marker), 'persistence: restored content is present in both panes');
} catch (e) {
  fails.push('exception: ' + e.message);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

console.log(fails.length ? `\n${fails.length} failure(s)` : '\nall persistence checks passed');
process.exit(fails.length ? 1 : 0);
