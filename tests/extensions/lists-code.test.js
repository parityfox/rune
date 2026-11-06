import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { BulletList } from '../../src/extensions/blocks/BulletList.js';
import { OrderedList } from '../../src/extensions/blocks/OrderedList.js';
import { Code } from '../../src/extensions/marks/Code.js';
import { Bold } from '../../src/extensions/marks/Bold.js';

describe('list unwrap and inline code', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });
  const clean = (h) => h.replace(/ data-id="[^"]*"/g, '');
  function make(content) {
    editor = new Editor(target, { extensions: [Paragraph, BulletList, OrderedList, Code, Bold], toolbar: false, bubbleMenu: false, slashMenu: false, content });
  }
  function caretInto(el) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function select(sn, so, en, eo) {
    const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  it('toggleBulletList keeps nested items once, as a list after their parent (#143)', () => {
    make('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>');
    caretInto(editor.content.querySelector('li'));
    editor.cmd('toggleBulletList');
    expect(clean(editor.getHtml())).toBe('<p>a</p><ul><li>b</li></ul><p>c</p>');
  });

  it('toggleOrderedList keeps nested items once, as a list after their parent (#143)', () => {
    make('<ol><li>a<ol><li>b</li></ol></li></ol>');
    caretInto(editor.content.querySelector('li'));
    editor.cmd('toggleOrderedList');
    expect(clean(editor.getHtml())).toBe('<p>a</p><ol><li>b</li></ol>');
  });

  it('wraps a selection that crosses into an inline element (#146)', () => {
    make('<p>ab<strong>cd</strong>ef</p>');
    const p = editor.content.querySelector('p');
    select(p.firstChild, 1, p.querySelector('strong').firstChild, 1);
    expect(() => editor.cmd('toggleInlineCode')).not.toThrow();
    const code = editor.content.querySelector('code');
    expect(code.textContent).toBe('bc');
    expect(p.textContent).toBe('abcdef');
  });

  it('leaves a selection spanning two blocks alone (#146)', () => {
    make('<p>one</p><p>two</p>');
    const [a, b] = editor.content.querySelectorAll('p');
    select(a.firstChild, 1, b.firstChild, 1);
    expect(() => editor.cmd('toggleInlineCode')).not.toThrow();
    expect(clean(editor.getHtml())).toBe('<p>one</p><p>two</p>');
  });
});
