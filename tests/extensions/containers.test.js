import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Toggle } from '../../src/extensions/blocks/Toggle.js';
import { Columns } from '../../src/extensions/blocks/Columns.js';
import { Table } from '../../src/extensions/blocks/Table.js';
import { Callout } from '../../src/extensions/blocks/Callout.js';
import { TaskList } from '../../src/extensions/blocks/TaskList.js';
import { Heading } from '../../src/extensions/blocks/Heading.js';
import { Blockquote } from '../../src/extensions/blocks/Blockquote.js';
import { CodeBlock } from '../../src/extensions/blocks/CodeBlock.js';
import { BulletList } from '../../src/extensions/blocks/BulletList.js';
import { OrderedList } from '../../src/extensions/blocks/OrderedList.js';
import { HorizontalRule } from '../../src/extensions/blocks/HorizontalRule.js';
import { Image } from '../../src/extensions/blocks/Image.js';

describe('Container blocks: Toggle + Columns (#88)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function caretInto(el) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function make(extensions) {
    editor = new Editor(target, { extensions, toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p></p>' });
    caretInto(editor.content.querySelector('p'));
  }

  it('insertToggle builds a collapsible structure', () => {
    make([Paragraph, Toggle]);
    editor.cmd('insertToggle');
    const t = editor.content.querySelector('.rune-toggle');
    expect(t).toBeTruthy();
    expect(t.classList.contains('is-open')).toBe(true);
    expect(t.querySelector('.rune-toggle-title')).toBeTruthy();
    expect(t.querySelector('.rune-toggle-body > p')).toBeTruthy();
  });

  it('clicking the arrow collapses and expands', () => {
    make([Paragraph, Toggle]);
    editor.cmd('insertToggle');
    const t = editor.content.querySelector('.rune-toggle');
    const arrow = t.querySelector('.rune-toggle-arrow');
    arrow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(t.classList.contains('is-open')).toBe(false);
    arrow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(t.classList.contains('is-open')).toBe(true);
  });

  it('getBlock targets the inner block inside a toggle body, not the container', () => {
    make([Paragraph, Toggle]);
    editor.cmd('insertToggle');
    const bodyP = editor.content.querySelector('.rune-toggle-body > p');
    caretInto(bodyP);
    expect(editor.selection.getBlock()).toBe(bodyP);
  });

  it('insertColumns builds N columns, each with a block', () => {
    make([Paragraph, Columns]);
    editor.cmd('insertColumns', 3);
    const cols = editor.content.querySelectorAll('.rune-columns > .rune-column');
    expect(cols.length).toBe(3);
    cols.forEach((c) => expect(c.querySelector('p')).toBeTruthy());
  });

  // #113: getBlock() returns the inner block inside a container region, whose
  // parent is the toggle body / column — not editor.content. Insert commands
  // must not assume content-level parentage.
  it('insertTable works when the caret is inside a toggle body (#113)', () => {
    make([Paragraph, Toggle, Table]);
    editor.cmd('insertToggle');
    const bodyP = editor.content.querySelector('.rune-toggle-body > p');
    caretInto(bodyP);
    expect(() => editor.cmd('insertTable', 2, 2)).not.toThrow();
    expect(editor.content.querySelector('.rune-toggle-body table.rune-table')).toBeTruthy();
  });

  it('insertCallout works when the caret is inside a column (#113)', () => {
    make([Paragraph, Columns, Callout]);
    editor.cmd('insertColumns', 2);
    const colP = editor.content.querySelector('.rune-column > p');
    caretInto(colP);
    expect(() => editor.cmd('insertCallout')).not.toThrow();
    expect(editor.content.querySelector('.rune-column .rune-callout')).toBeTruthy();
  });

  it('insertTaskList works when the caret is inside a toggle body (#113)', () => {
    make([Paragraph, Toggle, TaskList]);
    editor.cmd('insertToggle');
    const bodyP = editor.content.querySelector('.rune-toggle-body > p');
    caretInto(bodyP);
    expect(() => editor.cmd('insertTaskList')).not.toThrow();
    expect(editor.content.querySelector('.rune-toggle-body .rune-task-list')).toBeTruthy();
  });

  it('survives a getHtml -> setHtml round trip', () => {
    make([Paragraph, Toggle]);
    editor.cmd('insertToggle');
    editor.setHtml(editor.getHtml());
    const t = editor.content.querySelector('.rune-toggle');
    expect(t).toBeTruthy();
    expect(t.querySelector('.rune-toggle-body > p')).toBeTruthy();
    expect(t.querySelector('.rune-toggle-arrow')?.getAttribute('contenteditable')).toBe('false');
  });
});

describe('Block commands inside a container region (#133, #145)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function caretInto(el) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  // Caret in a paragraph with text inside an open toggle body.
  function inToggle(extensions, text = 'inner') {
    editor = new Editor(target, {
      extensions: [Paragraph, Toggle, ...extensions],
      toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p></p>',
    });
    caretInto(editor.content.querySelector('p'));
    editor.cmd('insertToggle');
    const body = editor.content.querySelector('.rune-toggle-body');
    const p = body.querySelector('p');
    if (text) p.textContent = text; else p.innerHTML = '<br>';
    caretInto(p);
    return body;
  }

  it('setHeading converts the block in place', () => {
    const body = inToggle([Heading]);
    editor.cmd('setHeading', 2);
    expect(body.querySelector('h2')?.textContent).toBe('inner');
  });

  it('toggleBlockquote converts in both directions', () => {
    const body = inToggle([Blockquote]);
    editor.cmd('toggleBlockquote');
    expect(body.querySelector('blockquote')?.textContent).toBe('inner');
    caretInto(body.querySelector('blockquote'));
    editor.cmd('toggleBlockquote');
    expect(body.querySelector('p')?.textContent).toBe('inner');
  });

  it('toggleCodeBlock converts in both directions', () => {
    const body = inToggle([CodeBlock]);
    editor.cmd('toggleCodeBlock');
    expect(body.querySelector('pre code')?.textContent).toBe('inner');
    caretInto(body.querySelector('pre'));
    editor.cmd('toggleCodeBlock');
    expect(body.querySelector('p')?.textContent).toBe('inner');
  });

  it('core setBlock converts in place', () => {
    const body = inToggle([Heading]);
    editor.chain().setBlock('heading').run();
    expect(body.querySelector('h1')?.textContent).toBe('inner');
  });

  it('core insertBlock stays in the region', () => {
    const body = inToggle([]);
    editor.chain().insertBlock('paragraph').run();
    expect(body.querySelectorAll('p').length).toBe(2);
  });

  it('core insertBlock stays in the region when the caret block is not last', () => {
    const body = inToggle([]);
    const first = body.querySelector('p');
    first.after(document.createElement('p'));
    caretInto(first);
    editor.chain().insertBlock('paragraph').run();
    expect(body.querySelectorAll('p').length).toBe(3);
  });

  it('deleteBlock keeps an editable block in the region', () => {
    const body = inToggle([]);
    editor.chain().deleteBlock().run();
    expect(body.querySelector('p')).toBeTruthy();
  });

  it('unwrapping a list stays in the region', () => {
    const body = inToggle([BulletList, OrderedList]);
    body.innerHTML = '<ul><li>a</li></ul>';
    caretInto(body.querySelector('li'));
    editor.cmd('toggleBulletList');
    expect(body.querySelector('p')?.textContent).toBe('a');
    body.innerHTML = '<ol><li>b</li></ol>';
    caretInto(body.querySelector('li'));
    editor.cmd('toggleOrderedList');
    expect(body.querySelector('p')?.textContent).toBe('b');
  });

  it('insertHorizontalRule stays in the region', () => {
    const body = inToggle([HorizontalRule]);
    editor.cmd('insertHorizontalRule');
    expect(body.querySelector('hr')).toBeTruthy();
    expect(body.lastElementChild.tagName).toBe('P');
  });

  it('insertImage stays in the region', () => {
    const body = inToggle([Image]);
    editor.cmd('insertImage', 'https://example.com/x.png');
    expect(body.querySelector('figure img')).toBeTruthy();
    expect(body.lastElementChild.tagName).toBe('P');
  });

  it('exiting an empty task list stays in the region', () => {
    const body = inToggle([TaskList], '');
    editor.cmd('insertTaskList');
    const content = body.querySelector('.rune-task-content');
    content.innerHTML = '';
    const r = document.createRange(); r.setStart(content, 0); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    const anchor = document.createTextNode('');
    content.appendChild(anchor);
    r.setStart(anchor, 0); r.collapse(true); s.removeAllRanges(); s.addRange(r);
    editor.content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(body.querySelector('.rune-task-list')).toBeNull();
    expect(body.querySelector('p')).toBeTruthy();
  });
});
