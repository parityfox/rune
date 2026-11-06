import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Heading } from '../../src/extensions/blocks/Heading.js';
import { Table } from '../../src/extensions/blocks/Table.js';
import { Image } from '../../src/extensions/blocks/Image.js';
import { Toggle } from '../../src/extensions/blocks/Toggle.js';

describe('Backspace in an empty block (#134)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function caretInto(el) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function make(extensions, content = '<p></p>') {
    editor = new Editor(target, { extensions: [Paragraph, ...extensions], toolbar: false, bubbleMenu: false, slashMenu: false, content });
    caretInto(editor.content.querySelector('p'));
  }
  const backspace = () => editor.content.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));

  it('keeps a table when the caret is in an empty cell', () => {
    make([Table]);
    editor.cmd('insertTable');
    caretInto(editor.content.querySelector('td'));
    backspace();
    expect(editor.content.querySelector('table')).toBeTruthy();
  });

  it('keeps an image when the caret is in its empty caption', () => {
    make([Image]);
    editor.cmd('insertImage', 'https://example.com/x.png');
    caretInto(editor.content.querySelector('figcaption'));
    backspace();
    expect(editor.content.querySelector('figure img')).toBeTruthy();
  });

  it('passes the key to extensions for structural blocks', () => {
    make([Table]);
    editor.cmd('insertTable');
    let seen = false;
    editor.events.on('keydown', () => { seen = true; });
    caretInto(editor.content.querySelector('td'));
    backspace();
    expect(seen).toBe(true);
  });

  it('still removes an empty paragraph or heading', () => {
    make([Heading], '<p>a</p><p><br></p><h2><br></h2>');
    caretInto(editor.content.querySelector('h2'));
    backspace();
    expect(editor.content.querySelector('h2')).toBeNull();
    caretInto(editor.content.querySelectorAll('p')[1]);
    backspace();
    expect(editor.content.querySelectorAll('p').length).toBe(1);
  });

  it('does not remove the only block of a toggle body', () => {
    make([Toggle]);
    editor.cmd('insertToggle');
    const body = editor.content.querySelector('.rune-toggle-body');
    caretInto(body.querySelector('p'));
    backspace();
    expect(body.querySelector('p')).toBeTruthy();
  });
});
