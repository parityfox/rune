import { describe, it, expect, vi, beforeEach } from 'vitest';
import { History } from '../../src/core/History.js';

function mockEditor(html = '<p>initial</p>') {
  const content = document.createElement('div');
  content.innerHTML = html;
  const editor = {
    content,
    events: { emit: vi.fn() },
    _ensureContent: vi.fn(),
    options: {},
  };
  // Mirror the real Editor: _apply() routes through _notifyChange, which emits
  // the 'change' event (with the current serialized html) and fires onChange.
  editor._notifyChange = vi.fn(() => {
    editor.events.emit('change', { editor, html: content.innerHTML });
  });
  return editor;
}

describe('History', () => {
  it('saves and undoes snapshots', () => {
    const editor = mockEditor();
    const h = new History(editor);

    h.saveNow(); // snapshot 0: <p>initial</p>
    editor.content.innerHTML = '<p>changed</p>';
    h.saveNow(); // snapshot 1: <p>changed</p>

    expect(h.canUndo).toBe(true);
    h.undo();
    expect(editor.content.innerHTML).toBe('<p>initial</p>');
  });

  it('redo restores after undo', () => {
    const editor = mockEditor();
    const h = new History(editor);

    h.saveNow();
    editor.content.innerHTML = '<p>v2</p>';
    h.saveNow();

    h.undo();
    expect(h.canRedo).toBe(true);
    h.redo();
    expect(editor.content.innerHTML).toBe('<p>v2</p>');
  });

  it('returns false when nothing to undo/redo', () => {
    const editor = mockEditor();
    const h = new History(editor);
    expect(h.undo()).toBe(false);
    expect(h.redo()).toBe(false);
  });

  it('drops redo states on new push', () => {
    const editor = mockEditor();
    const h = new History(editor);

    h.saveNow();
    editor.content.innerHTML = '<p>v2</p>';
    h.saveNow();
    editor.content.innerHTML = '<p>v3</p>';
    h.saveNow();

    h.undo(); // back to v2
    editor.content.innerHTML = '<p>v4</p>';
    h.saveNow(); // new branch

    expect(h.canRedo).toBe(false);
  });

  it('respects maxSize limit', () => {
    const editor = mockEditor();
    const h = new History(editor, { maxSize: 3 });

    for (let i = 0; i < 5; i++) {
      editor.content.innerHTML = `<p>v${i}</p>`;
      h.saveNow();
    }

    // Should only keep last 3 entries
    expect(h._stack.length).toBeLessThanOrEqual(3);
  });

  it('respects maxBytes limit', () => {
    const editor = mockEditor();
    const h = new History(editor, { maxBytes: 200 });

    for (let i = 0; i < 10; i++) {
      editor.content.innerHTML = `<p>${'x'.repeat(50)} ${i}</p>`;
      h.saveNow();
    }

    const total = h._stack.reduce((sum, s) => sum + s.length, 0);
    expect(total).toBeLessThanOrEqual(200 + 100); // some slack for the last entry
  });

  it('strips large base64 data URIs from snapshots', () => {
    const editor = mockEditor();
    const h = new History(editor);

    const bigBase64 = 'data:image/png;base64,' + 'A'.repeat(300);
    editor.content.innerHTML = `<img src="${bigBase64}">`;
    h.saveNow();

    // The stored snapshot should not contain the full base64
    expect(h._stack[0]).not.toContain(bigBase64);
    expect(h._stack[0]).toContain('src=""');
  });

  it('keeps small src attributes intact', () => {
    const editor = mockEditor();
    const h = new History(editor);

    editor.content.innerHTML = '<img src="https://example.com/img.png">';
    h.saveNow();

    expect(h._stack[0]).toContain('https://example.com/img.png');
  });

  it('skips duplicate snapshots', () => {
    const editor = mockEditor();
    const h = new History(editor);

    editor.content.innerHTML = '<p>same</p>';
    h.saveNow();
    h.saveNow();
    h.saveNow();

    expect(h._stack.length).toBe(1);
  });

  it('restores the caret offset on undo (#28)', () => {
    const content = document.createElement('div');
    content.innerHTML = '<p>hello</p>';
    document.body.appendChild(content);
    const editor = { content, events: { emit: () => {} }, _ensureContent: () => {} };
    editor._notifyChange = () => {};
    const h = new History(editor);

    const sel = window.getSelection();
    const setCaret = (node, off) => {
      const r = document.createRange(); r.setStart(node, off); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
    };

    setCaret(content.querySelector('p').firstChild, 5);   // end of "hello"
    h.saveNow();                                          // snapshot A (caret 5)

    content.querySelector('p').textContent = 'hello world';
    setCaret(content.querySelector('p').firstChild, 11);
    h.saveNow();                                          // snapshot B (caret 11)

    h.undo();
    expect(content.querySelector('p').textContent).toBe('hello');
    expect(window.getSelection().getRangeAt(0).startOffset).toBe(5);

    content.remove();
  });

  it('emits change event with correct shape on undo', () => {
    const editor = mockEditor();
    const h = new History(editor);

    h.saveNow();
    editor.content.innerHTML = '<p>v2</p>';
    h.saveNow();
    h.undo();

    expect(editor.events.emit).toHaveBeenCalledWith('change', {
      editor,
      html: '<p>initial</p>',
    });
  });
});
