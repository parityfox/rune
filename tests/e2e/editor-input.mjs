/**
 * Real-browser e2e for input paths happy-dom can't exercise: real key events,
 * execCommand, native drag-and-drop and live Ranges. Starts a static server,
 * drives system Chrome, exits non-zero on failure. Requires Google Chrome.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4174;
const ORIGIN = `http://localhost:${PORT}`;
const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

const server = spawn('npx', ['--yes', 'serve', '.', '-p', String(PORT)], { stdio: 'ignore' });

async function waitUp() {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${ORIGIN}/examples/index.html`)).ok) return; } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error('static server did not start');
}

let browser;
try {
  await waitUp();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
  await page.goto(`${ORIGIN}/LICENSE`);
  const fresh = async (content) => {
    await page.evaluate(async (content) => {
      const { Editor, StarterKit } = await import('/src/index.js');
      window.ed?.destroy();
      document.body.innerHTML = '<link rel="stylesheet" href="/styles/rune.css"><div id="t"></div>';
      await new Promise((resolve) => { document.querySelector('link').onload = resolve; });
      window.ed = new Editor('#t', { extensions: StarterKit, content, toolbar: false, bubbleMenu: false });
      window.changes = 0;
      window.ed.events.on('change', () => { window.changes++; });
      window.ed.focus();
    }, content);
    await sleep(120);                        // the slash menu is imported lazily
  };
  const caretAtEnd = () => page.evaluate(() => {
    const p = window.ed.content.lastElementChild;
    const r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  const text = () => page.evaluate(() => window.ed.content.textContent);
  const html = () => page.evaluate(() => window.ed.content.innerHTML.replace(/ data-id="[^"]*"/g, ''));

  // ── Slash menu ─────────────────────────────────────────────
  await fresh('<p>abc</p>');
  await caretAtEnd();
  await page.keyboard.type('/h');
  await page.keyboard.press('Enter');
  ok((await text()) === 'abc', `slash: picking an item keeps the text before the slash (got "${await text()}")`);

  await fresh('<p>ab</p>');
  await caretAtEnd();
  await page.keyboard.type('/');
  await page.keyboard.press('Backspace');
  ok((await text()) === 'ab', `slash: Backspace on an empty query removes only the slash (got "${await text()}")`);

  await fresh('<p>x</p>');
  await caretAtEnd();
  await page.keyboard.type('/zzzq');
  await page.keyboard.press('Enter');
  ok((await page.evaluate(() => window.ed.content.children.length)) === 2, 'slash: Enter with no matches makes a new block');

  // ── Backspace on structural blocks ─────────────────────────
  await fresh('<p></p>');
  await page.evaluate(() => window.ed.cmd('insertTable'));
  await page.click('#t td');
  await page.keyboard.press('Backspace');
  ok(await page.evaluate(() => !!window.ed.content.querySelector('table')), 'backspace: an empty cell keeps the table');

  await fresh('<p>a</p><p>b</p>');
  await page.evaluate(() => {
    window.ed.content.children[1].innerHTML = '<br>';
    const r = document.createRange(); r.selectNodeContents(window.ed.content.children[1]); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await page.keyboard.press('Backspace');
  ok((await page.evaluate(() => window.ed.content.children.length)) === 1, 'backspace: an empty paragraph is still removed');

  // ── Paste through real execCommand ─────────────────────────
  const paste = (plain, rich = '') => page.evaluate(([plain, rich]) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', plain);
    if (rich) dt.setData('text/html', rich);
    window.ed.content.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, [plain, rich]);

  // A real click and the real clipboard, into the real empty-editor state.
  const realPaste = async (clip) => {
    await fresh('');
    await page.evaluate((clip) => navigator.clipboard.writeText(clip), clip);
    await page.click('#t .rune-content');
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
    await sleep(100);
  };
  await realPaste('<b>x</b> &amp; y');
  ok((await text()) === '<b>x</b> &amp; y', 'paste: plain text stays literal');
  ok(await page.evaluate(() => !window.ed.content.querySelector('b')), 'paste: plain text makes no markup');
  ok((await page.evaluate(() => window.changes)) === 1, 'paste: one change event');

  await realPaste('one\ntwo');
  ok(await page.evaluate(() => !!window.ed.content.querySelector('br') && window.ed.content.innerText.includes('two')), 'paste: a newline becomes a line break');

  await fresh('<pre><code>x</code></pre>');
  await page.evaluate(() => {
    const r = document.createRange(); r.selectNodeContents(window.ed.content.querySelector('code')); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await paste('\na\nb');
  ok((await page.evaluate(() => window.ed.content.querySelector('pre').textContent)) === 'x\na\nb', 'paste: newlines survive inside a code block');

  await fresh('<p>a--</p>');
  await caretAtEnd();
  await paste('b');
  ok((await text()) === 'a--b', 'paste: input rules do not rewrite the text around it');

  // ── Formatting ─────────────────────────────────────────────
  await fresh('<p>hi</p>');
  await page.evaluate(() => {
    const t = window.ed.content.querySelector('p').firstChild;
    const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 2);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    window.changes = 0;
    window.ed.cmd('toggleBold');
  });
  ok((await page.evaluate(() => window.changes)) === 1, 'format: bold fires one change event');

  await fresh('<p>ab<strong>cd</strong>ef</p>');
  await page.evaluate(() => {
    const p = window.ed.content.querySelector('p');
    const r = document.createRange(); r.setStart(p.firstChild, 1); r.setEnd(p.querySelector('strong').firstChild, 1);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    window.ed.cmd('toggleInlineCode');
  });
  ok((await page.evaluate(() => window.ed.content.querySelector('code')?.textContent)) === 'bc', 'code: wraps across a bold boundary');
  ok((await text()) === 'abcdef', 'code: no text lost');

  await fresh('<p><span style="color: red;">abcd</span></p>');
  await page.evaluate(() => {
    const t = window.ed.content.querySelector('span').firstChild;
    const r = document.createRange(); r.setStart(t, 1); r.setEnd(t, 3);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    window.ed.cmd('setTextColor', 'inherit');
  });
  ok((await html()) === '<p><span style="color: red;">a</span>bc<span style="color: red;">d</span></p>', 'color: Default clears only the selection');

  // ── Drag and drop ──────────────────────────────────────────
  // Headless Chrome won't start a native text drag (not even on a plain
  // contenteditable), so this drives the events with a real DataTransfer: the token
  // written at dragstart must round-trip and leave the browser's native move alone.
  await fresh('<p>hello</p>');
  const internal = await page.evaluate(() => {
    const dt = new DataTransfer();
    const c = window.ed.content;
    c.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
    const drop = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true });
    c.dispatchEvent(drop);
    return { prevented: drop.defaultPrevented, types: [...dt.types] };
  });
  ok(internal.types.includes('application/x-rune-drag'), 'drag: dragstart writes the token');
  ok(!internal.prevented, 'drag: a matching drop is left to the native move');

  await fresh('<p>one</p><p>five</p>');
  await caretAtEnd();
  await page.evaluate(() => {
    const first = window.ed.content.firstElementChild.getBoundingClientRect();
    const dt = new DataTransfer();
    dt.setData('text/html', '<img src=x onerror="window.pwned=1"><b>DROP</b>');
    window.ed.content.dispatchEvent(new DragEvent('drop', {
      dataTransfer: dt, bubbles: true, cancelable: true, clientX: first.left + 1, clientY: first.top + first.height / 2,
    }));
  });
  await sleep(100);
  ok((await page.evaluate(() => window.ed.content.firstElementChild.textContent)).includes('DROP'), 'drop: lands at the drop point');
  ok((await page.evaluate(() => !window.pwned && !window.ed.content.innerHTML.includes('onerror'))), 'drop: an external drop is sanitized');

  // A drag that never gets its dragend must not disarm the sanitizer.
  await fresh('<p>one</p>');
  await page.evaluate(() => {
    window.ed.content.dispatchEvent(new DragEvent('dragstart', { dataTransfer: new DataTransfer(), bubbles: true }));
    const dt = new DataTransfer();
    dt.setData('text/html', '<img src=x onerror="window.pwned=1"><b>DROP</b>');
    window.ed.content.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
  });
  await sleep(100);
  ok((await page.evaluate(() => !window.pwned && !window.ed.content.innerHTML.includes('onerror'))), 'drop: a stale drag does not bypass the sanitizer');
} finally {
  await browser?.close();
  server.kill();
}

if (fails.length) {
  console.error(`\n${fails.length} check(s) failed`);
  fails.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log('\nall editor input checks passed');
