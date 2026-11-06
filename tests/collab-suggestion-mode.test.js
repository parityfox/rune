import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';
import { Bold } from '../src/extensions/marks/Bold.js';
import { MemoryHub } from '../collab/memory-hub.js';
import { bindParagraph } from '../collab/paragraph-binding.js';
import { SuggestionStore } from '../collab/suggestions.js';
import { bindSuggestionMode } from '../collab/suggestion-mode.js';

describe('bindSuggestionMode', () => {
  let target, editor, doc, mode, enabled, store;
  beforeEach(() => {
    target = document.createElement('div'); document.body.appendChild(target);
    doc = new Y.Doc();
    editor = new Editor(target, { extensions: [Paragraph, Bold], toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p>hello</p><p>second</p>' });
    bindParagraph(editor, doc);
    enabled = true;
    mode = bindSuggestionMode(editor, doc, { author: 'Ada', color: '#f00', isEnabled: () => enabled });
    store = new SuggestionStore(doc);
  });
  afterEach(() => {
    if (!editor._destroyed) editor.destroy();
    target.remove();
  });

  const para = (i = 0) => editor.content.querySelectorAll('p')[i];
  const ytext = (i = 0) => doc.getArray('blocks').get(i).get('text');
  const textOf = (i = 0) => ytext(i).toString();
  const list = () => store.list();
  const blockId = (i = 0) => doc.getArray('blocks').get(i).get('id');
  function caret(off, i = 0) {
    const r = document.createRange(); r.setStart(para(i).firstChild, off); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function select(a, b, i = 0) {
    const r = document.createRange(); r.setStart(para(i).firstChild, a); r.setEnd(para(i).firstChild, b);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function input(inputType, data = null) {
    const e = new Event('beforeinput', { bubbles: true, cancelable: true });
    Object.assign(e, { inputType, data });
    editor.content.dispatchEvent(e);
    return e;
  }
  function paste({ html = '', plain = '' }) {
    let direct = false;
    const orig = document.execCommand;
    document.execCommand = () => { direct = true; return true; };
    const e = new Event('paste', { bubbles: true, cancelable: true });
    e.clipboardData = { getData: (t) => (t === 'text/html' ? html : t === 'text/plain' ? plain : '') };
    editor.content.dispatchEvent(e);
    document.execCommand = orig;
    return { e, direct };
  }
  const caretOffset = () => window.getSelection().anchorOffset;

  describe('typing', () => {
    it('becomes a tracked insertion, and the caret follows', () => {
      caret(5);
      expect(input('insertText', 'X').defaultPrevented).toBe(true);
      expect(textOf()).toBe('helloX');
      expect(list()).toMatchObject([{ type: 'insert', author: 'Ada', color: '#f00', from: 5, to: 6 }]);
      expect(para().textContent).toBe('helloX');
    });

    it('merges a typed run into one suggestion', () => {
      caret(5);
      input('insertText', 'a');
      input('insertText', 'b');           // the mode left the caret after "a"
      expect(textOf()).toBe('helloab');
      expect(list().length).toBe(1);
    });

    it('leaves the browser alone when the mode is off', () => {
      enabled = false;
      caret(5);
      expect(input('insertText', 'X').defaultPrevented).toBe(false);
      expect(textOf()).toBe('hello');
    });

    it('is cleared by accept and removed by reject', () => {
      caret(5);
      input('insertText', 'X');
      store.reject(list()[0].id);
      expect(textOf()).toBe('hello');
      caret(5);
      input('insertText', 'Y');
      store.accept(list()[0].id);
      expect(textOf()).toBe('helloY');
      expect(list()).toEqual([]);
    });

    it('reaches a peer as a suggestion', () => {
      const hub = new MemoryHub();
      const peer = new Y.Doc();
      hub.connect(doc); hub.connect(peer);
      hub.resume();
      caret(5);
      input('insertText', 'X');
      expect(new SuggestionStore(peer).list()).toMatchObject([{ type: 'insert', author: 'Ada' }]);
    });
  });

  describe('Backspace', () => {
    it('marks a character deleted and keeps the text', () => {
      caret(5);
      expect(input('deleteContentBackward').defaultPrevented).toBe(true);
      expect(textOf()).toBe('hello');
      expect(list()).toMatchObject([{ type: 'delete', from: 4, to: 5 }]);
      expect(caretOffset()).toBe(4);
    });

    it('merges neighbouring deletions', () => {
      caret(5);
      input('deleteContentBackward');
      caret(4);
      input('deleteContentBackward');
      expect(list()).toMatchObject([{ type: 'delete', from: 3, to: 5 }]);
    });

    it('un-types your own pending insertion', () => {
      caret(5);
      input('insertText', 'X');           // the mode left the caret after "X"
      input('deleteContentBackward');
      expect(textOf()).toBe('hello');
      expect(list()).toEqual([]);
    });

    it('marks another author\'s insertion rather than removing it', () => {
      ytext().insert(5, 'B', { suggestion: { id: 'other', type: 'insert', author: 'Bob' } });
      const last = para().lastChild;
      const node = last.nodeType === 3 ? last : last.firstChild;
      const r = document.createRange(); r.setStart(node, node.length); r.collapse(true);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      input('deleteContentBackward');
      expect(textOf()).toBe('helloB');
      expect(list()).toMatchObject([{ type: 'delete', author: 'Ada', from: 5, to: 6 }]);
    });

    it('does nothing at the start of a block, without merging blocks', () => {
      caret(0, 1);
      expect(input('deleteContentBackward').defaultPrevented).toBe(true);
      expect(list()).toEqual([]);
      expect(doc.getArray('blocks').length).toBe(2);
    });
  });

  describe('forward Delete', () => {
    it('marks the next character deleted and keeps the text', () => {
      caret(0);
      expect(input('deleteContentForward').defaultPrevented).toBe(true);
      expect(textOf()).toBe('hello');
      expect(list()).toMatchObject([{ type: 'delete', from: 0, to: 1 }]);
      expect(caretOffset()).toBe(1);
    });

    it('un-types your own pending insertion', () => {
      caret(5);
      input('insertText', 'X');
      caret(5);                           // back in front of the "X"
      input('deleteContentForward');
      expect(textOf()).toBe('hello');
      expect(list()).toEqual([]);
    });

    it('does nothing at the end of a block, without merging blocks', () => {
      caret(5);
      expect(input('deleteContentForward').defaultPrevented).toBe(true);
      expect(list()).toEqual([]);
      expect(doc.getArray('blocks').length).toBe(2);
    });
  });

  describe('selections', () => {
    it('typing over one marks it deleted and inserts the new text', () => {
      select(0, 2);
      expect(input('insertText', 'X').defaultPrevented).toBe(true);
      expect(textOf()).toBe('heXllo');
      expect(list().map((s) => s.type).sort()).toEqual(['delete', 'insert']);
    });

    it('Delete marks it deleted and collapses to its start', () => {
      select(1, 3);
      input('deleteContentBackward');
      expect(textOf()).toBe('hello');
      expect(list()).toMatchObject([{ type: 'delete', from: 1, to: 3 }]);
      expect(caretOffset()).toBe(1);
    });

    it('across blocks falls back to normal editing', () => {
      const r = document.createRange();
      r.setStart(para(0).firstChild, 1); r.setEnd(para(1).firstChild, 1);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      expect(input('insertText', 'X').defaultPrevented).toBe(false);
      expect(list()).toEqual([]);
    });
  });

  describe('paste', () => {
    it('records plain text as one tracked insertion, skipping the direct insert', () => {
      caret(5);
      const { e, direct } = paste({ plain: 'XY' });
      expect(e.defaultPrevented).toBe(true);
      expect(direct).toBe(false);
      expect(textOf()).toBe('helloXY');
      expect(list()).toMatchObject([{ type: 'insert', from: 5, to: 7 }]);
    });

    it('keeps inline marks from HTML', () => {
      caret(5);
      paste({ html: '<b>XY</b>' });
      expect(textOf()).toBe('helloXY');
      const op = ytext().toDelta().find((o) => o.insert === 'XY');
      expect(op.attributes.suggestion.type).toBe('insert');
      expect(Object.keys(op.attributes).length).toBeGreaterThan(1);
    });

    it('strips hostile HTML', () => {
      caret(5);
      paste({ html: 'ok<img src=x onerror="alert(1)"><script>alert(2)</script>' });
      expect(textOf()).toContain('ok');
      expect(editor.content.innerHTML).not.toContain('onerror');
      expect(editor.content.querySelector('script')).toBeNull();
    });

    it('over a selection marks it deleted and inserts the new text', () => {
      select(0, 2);
      const { direct } = paste({ plain: 'XY' });
      expect(direct).toBe(false);
      expect(textOf()).toBe('heXYllo');
      expect(list().map((s) => s.type).sort()).toEqual(['delete', 'insert']);
    });

    it('leaves paste to the editor when the mode is off', () => {
      enabled = false;
      caret(5);
      expect(paste({ plain: 'X' }).direct).toBe(true);
      expect(list()).toEqual([]);
    });

    it('changes nothing on a disabled editor', () => {
      editor.disable();
      caret(5);
      paste({ plain: 'X' });
      expect(textOf()).toBe('hello');
      expect(list()).toEqual([]);
    });
  });

  describe('destroy', () => {
    it('stops intercepting', () => {
      mode.destroy();
      caret(5);
      expect(input('insertText', 'X').defaultPrevented).toBe(false);
      expect(paste({ plain: 'X' }).direct).toBe(true);
    });

    it('can be called twice, and runs with the editor', () => {
      mode.destroy();
      expect(() => mode.destroy()).not.toThrow();
      const again = bindSuggestionMode(editor, doc, { isEnabled: () => true });
      const content = editor.content;
      editor.destroy();
      const e = new Event('beforeinput', { bubbles: true, cancelable: true });
      Object.assign(e, { inputType: 'insertText', data: 'X' });
      content.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
      again.destroy();
    });
  });
});
