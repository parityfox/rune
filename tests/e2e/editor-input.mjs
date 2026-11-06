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

  // ── Toolbar panels from the keyboard ───────────────────────
  // Tab to an option and press Enter, with focus really inside the popup. Commands
  // that use execCommand need the selection and focus back in the editor by then.
  const toolbarFresh = async (content) => {
    await page.evaluate(async (content) => {
      const { Editor, StarterKit } = await import('/src/index.js');
      window.ed?.destroy();
      document.querySelectorAll('.rune-toolbar-popup').forEach((p) => p.remove());
      document.body.innerHTML = '<link rel="stylesheet" href="/styles/rune.css"><div id="t"></div>';
      await new Promise((resolve) => { document.querySelector('link').onload = resolve; });
      window.ed = new Editor('#t', {
        extensions: StarterKit, content, bubbleMenu: false, slashMenu: false,
        toolbar: { items: ['textColor', 'textBackground', 'highlight', 'fontFamily', 'fontSize', 'textAlign', 'lineHeight', 'emoji', 'callout', 'table'] },
      });
    }, content);
    await sleep(100);
    await page.evaluate(() => {
      const t = window.ed.content.querySelector('p').firstChild;
      window.ed.content.focus();
      const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 5);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    });
    await sleep(50);
  };
  // Opens a toolbar panel by keyboard and presses Enter on the option at `tabs`.
  const viaKeyboard = async (title, tabs) => {
    await page.evaluate((title) => document.querySelector(`.rune-toolbar button[aria-label="${title}"]`).focus(), title);
    await page.keyboard.press('Enter');
    await sleep(60);
    for (let i = 0; i < tabs; i++) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await sleep(220);
    return page.evaluate(() => ({
      html: window.ed.content.innerHTML.replace(/ data-id="[^"]*"/g, ''),
      focus: document.activeElement === document.body ? 'body' : (window.ed.content.contains(document.activeElement) ? 'editor' : document.activeElement.className),
      selected: getSelection().toString(),
    }));
  };
  const panels = [
    ['Text Color', 2, (r) => /color/i.test(r.html) && /<(span|font)/.test(r.html)],
    ['Highlight / Background', 2, (r) => /background/i.test(r.html)],
    ['Highlight', 1, (r) => /<mark/.test(r.html)],
    ['Font Family', 1, (r) => /font-family/i.test(r.html)],
    ['Font Size', 1, (r) => /font-size/i.test(r.html)],
    ['Text Align', 1, (r) => /text-align/i.test(r.html)],
    ['Line Height', 1, (r) => /line-height/i.test(r.html)],
    ['Emoji', 0, (r) => r.html.replace(/<[^>]+>/g, '') !== 'hello world'],
  ];
  for (const [title, tabs, applied] of panels) {
    await toolbarFresh('<p>hello world</p>');
    const r = await viaKeyboard(title, tabs);
    ok(applied(r), `panel keyboard: ${title} applies (${r.html.slice(0, 70)})`);
    ok(r.focus === 'editor', `panel keyboard: ${title} returns focus to the editor (got ${r.focus})`);
  }

  await toolbarFresh('<p>hello world</p>');
  await page.evaluate(() => document.querySelector('.rune-toolbar button[aria-label="Insert Table"]')?.focus());
  if (await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Insert Table')) {
    await page.keyboard.press('Enter');
    await sleep(60);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await sleep(220);
    const size = await page.evaluate(() => {
      const t = window.ed.content.querySelector('table');
      return t ? `${t.rows.length}x${t.rows[0].cells.length}` : 'none';
    });
    ok(size === '2x2', `panel keyboard: table grid inserts the size reached with arrows (got ${size})`);
  } else {
    ok(false, 'panel keyboard: table toolbar button found');
  }

  await toolbarFresh('<p>hello world</p>');
  await viaKeyboard('Text Color', 2);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('!');
  ok((await page.evaluate(() => window.ed.content.textContent)).includes('!'), 'panel keyboard: typing continues after choosing an option');

  await toolbarFresh('<p>hello world</p>');
  await page.evaluate(() => document.querySelector('.rune-toolbar button[aria-label="Text Color"]').focus());
  await page.keyboard.press('Enter');
  await sleep(60);
  await page.keyboard.press('Escape');
  await sleep(200);
  ok(await page.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Text Color'), 'panel keyboard: Escape still returns to the toolbar button');

  // The same panel with a real mouse must apply exactly once.
  await toolbarFresh('<p>hello world</p>');
  let changes = 0;
  await page.evaluate(() => { window.changes = 0; window.ed.events.on('change', () => { window.changes++; }); });
  await page.click('.rune-toolbar button[aria-label="Line Height"]');
  await sleep(60);
  await page.click('.rune-panel-lh-item:nth-of-type(2)');
  await sleep(220);
  changes = await page.evaluate(() => window.changes);
  ok(changes === 1, `panel mouse: applies once (got ${changes} changes)`);
  ok(await page.evaluate(() => window.ed.content.contains(document.activeElement)), 'panel mouse: focus returns to the editor');

  // ── Find and replace from the keyboard ─────────────────────
  const frOpen = async () => {
    await fresh('<p>cat cat cat</p>');
    await page.click('#t .rune-content');
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f');
    await sleep(80);
    await page.keyboard.type('cat');
    await sleep(80);
  };
  const frCount = () => page.evaluate(() => document.querySelector('.rune-fr-count').textContent);
  const frFocus = (title) => page.evaluate((title) => {
    [...document.querySelectorAll('.rune-fr-panel button')].find((b) => (b.title || b.textContent).startsWith(title)).focus();
  }, title);

  await frOpen();
  await frFocus('Next');
  await page.keyboard.press('Enter');
  ok((await frCount()) === '2/3', 'find: Enter on Next moves on');
  await page.keyboard.press('Space');
  ok((await frCount()) === '3/3', 'find: Space on Next moves on, with focus still on it');
  await frFocus('Previous');
  await page.keyboard.press('Enter');
  ok((await frCount()) === '2/3', 'find: Enter on Previous moves back');

  await frOpen();
  await page.keyboard.press('Tab');           // Previous
  await page.keyboard.press('Tab');           // Next
  await page.keyboard.press('Tab');           // Close
  await page.keyboard.press('Tab');           // Replace field
  await page.keyboard.type('dog');
  await page.keyboard.press('Tab');           // Replace button
  await page.keyboard.press('Enter');
  await sleep(50);
  ok((await text()).startsWith('dog cat cat'), `find: Tab to Replace and press Enter (got "${await text()}")`);
  await page.keyboard.press('Tab');           // All button
  await page.keyboard.press('Enter');
  await sleep(50);
  ok((await text()).startsWith('dog dog dog'), `find: Tab to All and press Enter (got "${await text()}")`);

  await frOpen();
  await frFocus('Next');
  await page.keyboard.press('Escape');
  await sleep(200);
  ok(await page.evaluate(() => !document.querySelector('.rune-fr-panel')), 'find: Escape from a button closes the panel');
  ok(await page.evaluate(() => window.ed.content.contains(document.activeElement)), 'find: focus returns to the editor');
  await page.keyboard.type('!');
  ok((await text()).includes('!'), 'find: typing continues after closing');

  await frOpen();
  await page.evaluate(() => { window.changes = 0; });
  await page.fill('.rune-fr-replace', 'dog');
  await page.click('.rune-fr-panel button:has-text("Replace")');
  await sleep(50);
  ok((await text()).split('dog').length === 2, `find: a mouse press on Replace acts once (got "${await text()}")`);
  await page.click('.rune-fr-panel button[title^="Next"]');
  ok(/^\d+\/\d+$/.test(await frCount()), 'find: a mouse press on Next still works');
  await page.keyboard.press('Escape');
  await sleep(200);

  // ── Table controls from the keyboard ───────────────────────
  const tableFresh = async () => {
    await fresh('<p>before</p>');
    await page.evaluate(() => {
      const p = window.ed.content.querySelector('p');
      const r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      window.ed.cmd('insertTable', 3, 3);
    });
    await sleep(60);
    await page.click('#t tbody tr:first-child td:nth-child(2)');
    await page.keyboard.type('here');
    await sleep(60);
  };
  const tableShape = () => page.evaluate(() => {
    const rows = [...window.ed.content.querySelectorAll('table tr')];
    return rows.length ? `${rows.length}x${rows[0].children.length}` : 'none';
  });
  const inEditor = () => page.evaluate(() => window.ed.content.contains(document.activeElement));
  const caretInTable = () => page.evaluate(() => {
    const n = getSelection().anchorNode;
    return !!(n?.nodeType === 1 ? n : n?.parentElement)?.closest?.('td, th');
  });
  const barFocus = () => page.evaluate(() => document.activeElement?.title || '');

  await tableFresh();
  await page.keyboard.press('Alt+F10');
  await sleep(40);
  ok((await barFocus()) === 'Insert column right', `table: Alt+F10 reaches the bar (got "${await barFocus()}")`);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  ok((await barFocus()) === 'Insert row below', `table: arrow keys move along the bar (got "${await barFocus()}")`);
  await page.keyboard.press('Enter');
  await sleep(60);
  ok((await tableShape()) === '4x3', `table: Enter on Row + adds a row (got ${await tableShape()})`);
  ok(await inEditor(), 'table: focus returns to the editor after a bar action');
  await page.keyboard.type('!');
  ok((await page.evaluate(() => window.ed.content.querySelector('tbody tr:first-child td:nth-child(2)').textContent)).includes('!'), 'table: typing continues in the same cell');

  await tableFresh();
  await page.keyboard.press('Alt+F10');
  await page.keyboard.press('Escape');
  await sleep(40);
  await page.keyboard.type('Z');
  ok((await page.evaluate(() => window.ed.content.querySelector('tbody tr:first-child td:nth-child(2)').textContent)) === 'hereZ', 'table: Escape returns to the same caret position');

  await tableFresh();
  await page.keyboard.press('Alt+F10');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await sleep(60);
  ok((await tableShape()) === '2x3', `table: Space on Row - deletes a row (got ${await tableShape()})`);
  ok(await inEditor() && await caretInTable(), 'table: caret stays in the table after deleting a row');

  await tableFresh();
  await page.keyboard.press('Alt+F10');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await sleep(60);
  ok((await tableShape()) === 'none', 'table: Delete table works from the bar');
  ok(await inEditor(), 'table: focus returns to the editor after deleting the table');
  await page.keyboard.type('Q');
  ok((await text()).includes('Q'), 'table: typing continues after deleting the table');

  for (const [label, combo] of [['Shift+F10', 'Shift+F10'], ['the Menu key', 'ContextMenu']]) {
    await tableFresh();
    await page.keyboard.press(combo);
    await sleep(60);
    ok(await page.evaluate(() => document.activeElement?.textContent === 'Insert row above'), `table: ${label} opens the menu on its first item`);
    await page.keyboard.press('ArrowDown');
    ok(await page.evaluate(() => document.activeElement?.textContent === 'Insert row below'), `table: arrow keys move through the menu after ${label}`);
    await page.keyboard.press('Escape');
    await sleep(40);
    ok(await page.evaluate(() => !document.querySelector('.rune-table-menu')) && await inEditor(), `table: Escape closes the menu after ${label}`);
  }

  await tableFresh();
  await page.keyboard.press('Shift+F10');
  await sleep(60);
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowUp');       // Delete column
  await page.keyboard.press('Enter');
  await sleep(60);
  ok((await tableShape()) === '3x2', `table: Enter on a menu item acts (got ${await tableShape()})`);
  ok(await inEditor() && await caretInTable(), 'table: caret stays in the table after a menu delete');

  await tableFresh();
  await page.click('#t tbody tr:first-child td:nth-child(2)', { button: 'right' });
  await sleep(60);
  const rightClick = await page.evaluate(() => {
    const m = document.querySelector('.rune-table-menu');
    return { open: !!m, opaque: m && getComputedStyle(m).pointerEvents };
  });
  ok(rightClick.open, 'table: a right click still opens the menu');
  await page.click('.rune-table-menu-item:has-text("Insert row below")');
  await sleep(60);
  ok((await tableShape()) === '4x3', `table: a mouse click on a menu item acts once (got ${await tableShape()})`);
  await page.click('.rune-table-bar-btn[title="Insert row below"]');
  await sleep(60);
  ok((await tableShape()) === '5x3', `table: a mouse click on the bar acts once (got ${await tableShape()})`);

  // ── Dragging a block by its handle (#190): pointer events do run in headless ──
  await fresh('<p>first</p><p>second</p><p>third</p>');
  await page.evaluate(() => {
    window.seen = [];
    window.ed.options.onChange = (html) => window.seen.push(html);
  });
  const firstBlock = await page.locator('#t .rune-content p').first().boundingBox();
  const lastBlock = await page.locator('#t .rune-content p').last().boundingBox();
  await page.mouse.move(firstBlock.x + 40, firstBlock.y + firstBlock.height / 2);
  await sleep(60);
  const grip = await page.locator('.rune-drag-handle').last().boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + 5, lastBlock.y + lastBlock.height, { steps: 6 });
  await sleep(80);
  const during = await page.evaluate(() => {
    const p = [...window.ed.content.querySelectorAll('p')].find((x) => x.textContent === 'first');
    return { opacity: +getComputedStyle(p).opacity, attrs: p.getAttributeNames().filter((n) => n !== 'data-id') };
  });
  ok(Math.abs(during.opacity - 0.35) < 0.01, `block drag: the block is steadily dimmed during the drag (opacity ${during.opacity})`);
  ok(during.attrs.length === 0, `block drag: no attributes are added during the drag (got ${during.attrs.join(',')})`);
  await page.mouse.up();
  await sleep(100);
  const afterDrag = await page.evaluate(() => ({
    order: [...window.ed.content.querySelectorAll('p')].map((p) => p.textContent).join(','),
    seen: window.seen.join(''),
    live: window.ed.getHtml(),
    opacity: +getComputedStyle([...window.ed.content.querySelectorAll('p')].find((x) => x.textContent === 'first')).opacity,
    count: window.seen.length,
  }));
  ok(afterDrag.order === 'second,third,first', `block drag: the block moved (got ${afterDrag.order})`);
  ok(afterDrag.count === 1 && !/rune-dragging|class=/.test(afterDrag.seen), `block drag: onChange HTML is clean (got ${afterDrag.seen.slice(0, 80)})`);
  ok(!/rune-dragging|class=/.test(afterDrag.live), 'block drag: getHtml is clean');
  ok(afterDrag.opacity === 1, `block drag: the dimming ends (opacity ${afterDrag.opacity})`);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await sleep(60);
  ok(!/rune-dragging|class=/.test(await page.evaluate(() => window.ed.getHtml())), 'block drag: undo stays clean');

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
