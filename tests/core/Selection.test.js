import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';

describe('Selection', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function make(content) {
    editor = new Editor(target, { extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false, content });
  }

  it('save/restore round-trips an unchanged range', () => {
    make('<p>hello world</p>');
    const text = editor.content.querySelector('p').firstChild;
    const r = document.createRange();
    r.setStart(text, 2); r.setEnd(text, 7);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);

    const saved = editor.selection.save();
    s.removeAllRanges();
    editor.selection.restore(saved);
    const got = window.getSelection().getRangeAt(0);
    expect([got.startOffset, got.endOffset]).toEqual([2, 7]);
  });

  // #114: the DOM can mutate between save and restore (undo innerHTML swap,
  // text-node trim/merge) — a stale offset must be clamped, not throw
  // IndexSizeError and abort the caller.
  it('restore() clamps a stale offset instead of throwing (#114)', () => {
    make('<p>hello world</p>');
    const text = editor.content.querySelector('p').firstChild;
    const r = document.createRange();
    r.setStart(text, 8); r.setEnd(text, 11);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);

    const saved = editor.selection.save();
    text.textContent = 'hi';                     // node shrank: offsets 8/11 are now stale
    s.removeAllRanges();

    expect(() => editor.selection.restore(saved)).not.toThrow();
    const sel = window.getSelection();
    if (sel.rangeCount) {
      const got = sel.getRangeAt(0);
      expect(got.startOffset).toBeLessThanOrEqual(2);
      expect(got.endOffset).toBeLessThanOrEqual(2);
    }
  });

  it('restore() survives a saved node that left the document (#114)', () => {
    make('<p>hello</p>');
    const p = editor.content.querySelector('p');
    const text = p.firstChild;
    const r = document.createRange();
    r.setStart(text, 1); r.setEnd(text, 3);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);

    const saved = editor.selection.save();
    editor.content.innerHTML = '<p>replaced</p>';   // old nodes detached
    s.removeAllRanges();

    expect(() => editor.selection.restore(saved)).not.toThrow();
  });
});
