import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';

describe('Decorations', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function make(content) {
    editor = new Editor(target, { extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false, content });
  }

  function decorate(node, from, to, opts = {}) {
    const r = document.createRange();
    r.setStart(node, from); r.setEnd(node, to);
    return editor.decorations.addRange(r, opts);
  }

  it('keeps a decoration whose anchor still resolves across renders', () => {
    make('<p>hello world</p>');
    const text = editor.content.querySelector('p').firstChild;
    const id = decorate(text, 0, 5, { type: 'search' });
    editor.decorations._render();
    expect(editor.decorations._items.has(id)).toBe(true);
  });

  // #115: a decoration whose {path, offset} anchor no longer resolves must be
  // dropped, or it lingers forever (leak) and re-projects onto whatever node
  // later occupies those indices (mispaint).
  it('prunes decorations whose anchor no longer resolves (#115)', () => {
    make('<p>one</p><p>two</p>');
    const p2Text = editor.content.children[1].firstChild;
    const id = decorate(p2Text, 0, 3, { type: 'search' });
    expect(editor.decorations._items.has(id)).toBe(true);

    editor.content.innerHTML = '<p>one</p>';   // second paragraph deleted
    editor.decorations._render();
    expect(editor.decorations._items.has(id)).toBe(false);
  });
});
