import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';
import { bindParagraph } from '../collab/paragraph-binding.js';
import { CommentStore } from '../collab/comments.js';
import { bindCommentsUI } from '../collab/comments-ui.js';

describe('bindCommentsUI', () => {
  let target, editor, doc, store, ui, onChange, origRects;
  beforeEach(() => {
    target = document.createElement('div'); document.body.appendChild(target);
    // happy-dom has no layout, so give every range one rectangle to draw.
    origRects = Range.prototype.getClientRects;
    Range.prototype.getClientRects = () => [{ left: 10, top: 20, width: 30, height: 15 }];
    doc = new Y.Doc();
    editor = new Editor(target, { extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p>hello world</p><p>second</p>' });
    bindParagraph(editor, doc);
    store = new CommentStore(doc);
    onChange = vi.fn();
    ui = bindCommentsUI(editor, doc, store, { onChange });
  });
  afterEach(() => {
    Range.prototype.getClientRects = origRects;
    if (!editor._destroyed) editor.destroy();
    target.remove();
  });

  const layer = () => target.querySelector('.rune-comment-layer');
  const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const blockId = (i = 0) => doc.getArray('blocks').get(i).get('id');
  const para = (i = 0) => editor.content.querySelectorAll('p')[i];
  function select(sn, so, en = sn, eo = so) {
    const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  it('adds its overlay outside the editable content', () => {
    expect(layer()).toBeTruthy();
    expect(editor.content.contains(layer())).toBe(false);
    expect(editor.getHtml()).not.toContain('rune-comment-layer');
  });

  it('makes a static wrapper a positioning context', () => {
    expect(getComputedStyle(editor.wrapper).position).not.toBe('static');
  });

  it('draws a highlight for a thread', () => {
    store.add({ blockId: blockId(), from: 0, to: 5, text: 't', author: 'a' });
    ui.render();
    expect(layer().children.length).toBe(1);
    expect(layer().firstChild.style.width).toBe('30px');
  });

  it('skips resolved threads', () => {
    const id = store.add({ blockId: blockId(), from: 0, to: 5, text: 't', author: 'a' });
    store.resolve(id);
    ui.render();
    expect(layer().children.length).toBe(0);
  });

  it('skips a thread whose text was deleted', () => {
    store.add({ blockId: blockId(), from: 0, to: 5, text: 't', author: 'a' });
    doc.getArray('blocks').get(0).get('text').delete(0, 5);
    ui.render();
    expect(layer().children.length).toBe(0);
  });

  it('skips a thread whose block has gone from the page', () => {
    store.add({ blockId: blockId(), from: 0, to: 5, text: 't', author: 'a' });
    para().removeAttribute('data-id');
    ui.render();
    expect(layer().children.length).toBe(0);
  });

  it('reports the threads on each render', () => {
    const id = store.add({ blockId: blockId(), from: 0, to: 5, text: 't', author: 'a' });
    ui.render();
    expect(onChange.mock.lastCall[0].map((t) => t.id)).toEqual([id]);
  });

  it('coalesces a burst of store changes into one render per frame', async () => {
    await frame();
    onChange.mockClear();
    for (let i = 0; i < 5; i++) store.add({ blockId: blockId(), from: 0, to: 2, text: 't', author: 'a' });
    expect(onChange).not.toHaveBeenCalled();
    await frame();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(layer().children.length).toBe(5);
  });

  it('re-renders on resize', async () => {
    await frame();
    onChange.mockClear();
    window.dispatchEvent(new Event('resize'));
    await frame();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  describe('addFromSelection', () => {
    it('creates a thread anchored to the selected text', () => {
      const t = para().firstChild;
      select(t, 6, t, 11);
      const id = ui.addFromSelection('Ada', 'note');
      const thread = store.list().find((x) => x.id === id);
      expect(thread.from).toBe(6);
      expect(thread.to).toBe(11);
      expect(thread.blockId).toBe(blockId());
      expect(thread.replies[0]).toMatchObject({ author: 'Ada', text: 'note' });
    });

    it('anchors a backward selection the same way', () => {
      const t = para().firstChild;
      select(t, 0, t, 5);
      window.getSelection().setBaseAndExtent?.(t, 5, t, 0);
      const id = ui.addFromSelection('Ada', 'note');
      const thread = store.list().find((x) => x.id === id);
      expect([thread.from, thread.to]).toEqual([0, 5]);
    });

    it('anchors in the right block after a block above it changes', () => {
      const t = para(1).firstChild;
      select(t, 0, t, 3);
      const id = ui.addFromSelection('Ada', 'note');
      expect(store.list().find((x) => x.id === id).blockId).toBe(blockId(1));
    });

    it('returns null for a collapsed selection', () => {
      select(para().firstChild, 2);
      expect(ui.addFromSelection('Ada', 'note')).toBeNull();
    });

    it('returns null with no selection', () => {
      window.getSelection().removeAllRanges();
      expect(ui.addFromSelection('Ada', 'note')).toBeNull();
    });

    it('returns null for a selection outside the editor', () => {
      const out = document.createElement('p');
      out.textContent = 'outside';
      document.body.appendChild(out);
      select(out.firstChild, 0, out.firstChild, 3);
      expect(ui.addFromSelection('Ada', 'note')).toBeNull();
      out.remove();
    });

    it('returns null for a selection across two blocks', () => {
      select(para(0).firstChild, 1, para(1).firstChild, 1);
      expect(ui.addFromSelection('Ada', 'note')).toBeNull();
    });

    it('returns null for a block not in the shared document', () => {
      const t = para().firstChild;
      select(t, 0, t, 2);
      para().setAttribute('data-id', 'not-in-the-doc');
      expect(ui.addFromSelection('Ada', 'note')).toBeNull();
    });
  });

  describe('destroy', () => {
    it('removes the layer and stops rendering', async () => {
      ui.destroy();
      expect(layer()).toBeNull();
      onChange.mockClear();
      store.add({ blockId: blockId(), from: 0, to: 2, text: 't', author: 'a' });
      window.dispatchEvent(new Event('resize'));
      await frame();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('cancels a pending render', async () => {
      store.add({ blockId: blockId(), from: 0, to: 2, text: 't', author: 'a' });
      onChange.mockClear();
      ui.destroy();
      await frame();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('can be called twice, and runs with the editor', () => {
      ui.destroy();
      expect(() => ui.destroy()).not.toThrow();
      const again = bindCommentsUI(editor, doc, store);
      expect(layer()).toBeTruthy();
      editor.destroy();
      expect(layer()).toBeNull();
      again.destroy();
    });
  });
});
