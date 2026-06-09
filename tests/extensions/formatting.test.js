import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { BulletList } from '../../src/extensions/blocks/BulletList.js';
import { Indent } from '../../src/extensions/formatting/Indent.js';
import { TextAlign } from '../../src/extensions/formatting/TextAlign.js';

describe('formatting targets the editable leaf, not the container (#37)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function caretInto(node) {
    const r = document.createRange();
    r.selectNodeContents(node);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  it('indent pads the <li>, not the whole <ul>', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, BulletList, Indent],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<ul><li>one</li><li>two</li></ul>',
    });
    const li = editor.content.querySelector('li');
    caretInto(li);
    editor.cmd('indentBlock');
    expect(li.style.paddingLeft).toBe('24px');
    expect(editor.content.querySelector('ul').style.paddingLeft).toBe('');
  });

  it('text-align applies to the <li>, not the whole <ul>', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, BulletList, TextAlign],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<ul><li>one</li></ul>',
    });
    const li = editor.content.querySelector('li');
    caretInto(li);
    editor.cmd('setTextAlign', 'center');
    expect(li.style.textAlign).toBe('center');
    expect(editor.content.querySelector('ul').style.textAlign).toBe('');
  });
});
