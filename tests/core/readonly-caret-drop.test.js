import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Heading } from '../../src/extensions/blocks/Heading.js';

describe('editor', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });
  function make(content, opts = {}) {
    editor = new Editor(target, { extensions: [Paragraph, Heading], toolbar: false, bubbleMenu: false, slashMenu: false, content, ...opts });
  }
  function caretInto(el) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  describe('disable() (#147)', () => {
    it('blocks commands and fires no change', () => {
      const onChange = vi.fn();
      make('<p>hi</p>', { onChange });
      caretInto(editor.content.querySelector('p'));
      editor.disable();
      expect(editor.cmd('setHeading', 1)).toBe(false);
      editor.chain().setBlock('heading').run();
      expect(editor.content.querySelector('h1')).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('still allows focus', () => {
      make('<p>hi</p>');
      editor.disable();
      const spy = vi.spyOn(editor, 'focus');
      editor.cmd('focus');
      expect(spy).toHaveBeenCalled();
    });

    it('enable() restores commands', () => {
      make('<p>hi</p>');
      caretInto(editor.content.querySelector('p'));
      editor.disable();
      editor.enable();
      editor.cmd('setHeading', 1);
      expect(editor.content.querySelector('h1')).toBeTruthy();
    });

    it('leaves setHtml working for programmatic updates', () => {
      make('<p>hi</p>');
      editor.disable();
      editor.setHtml('<p>new</p>');
      expect(editor.getHtml()).toContain('new');
    });
  });

  describe('undo caret (#148)', () => {
    it('returns to an empty paragraph', () => {
      make('<p>Hello</p><p><br></p><p>World</p>');
      caretInto(editor.content.querySelectorAll('p')[1]);
      editor.history.saveNow();
      editor.cmd('setHeading', 1);
      editor.history.undo();
      const sel = window.getSelection();
      const el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      expect(el).toBe(editor.content.querySelectorAll('p')[1]);
    });

    it('still restores a caret inside text', () => {
      make('<p>Hello</p><p>World</p>');
      const text = editor.content.querySelectorAll('p')[1].firstChild;
      const r = document.createRange(); r.setStart(text, 2); r.collapse(true);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      editor.history.saveNow();
      editor.cmd('setHeading', 1);
      editor.history.undo();
      const sel = window.getSelection();
      expect(sel.anchorNode.textContent).toBe('World');
      expect(sel.anchorOffset).toBe(2);
    });
  });

  describe('external drop (#149)', () => {
    function drop({ html = '', plain = '', files = [], x = 5, y = 6 } = {}) {
      let inserted = null;
      const orig = document.execCommand;
      document.execCommand = (cmd, ui, val) => { if (cmd === 'insertHTML') inserted = val; return true; };
      const e = new Event('drop', { bubbles: true, cancelable: true });
      e.clientX = x; e.clientY = y;
      e.dataTransfer = { getData: (t) => (t === 'text/html' ? html : t === 'text/plain' ? plain : ''), files };
      editor.content.dispatchEvent(e);
      document.execCommand = orig;
      return inserted;
    }

    it('moves the caret to the drop point before inserting', () => {
      make('<p>one</p><p>five</p>');
      const [one, five] = editor.content.querySelectorAll('p');
      caretInto(one);
      const point = document.createRange(); point.setStart(five.firstChild, 2); point.collapse(true);
      document.caretRangeFromPoint = vi.fn(() => point);
      drop({ plain: 'x' });
      const at = document.caretRangeFromPoint.mock.calls[0];
      delete document.caretRangeFromPoint;
      expect(at).toEqual([5, 6]);
      expect(window.getSelection().anchorNode).toBe(five.firstChild);
      expect(window.getSelection().anchorOffset).toBe(2);
    });

    it('supports caretPositionFromPoint', () => {
      make('<p>one</p><p>five</p>');
      const five = editor.content.querySelectorAll('p')[1];
      document.caretPositionFromPoint = () => ({ offsetNode: five.firstChild, offset: 1 });
      drop({ plain: 'x' });
      delete document.caretPositionFromPoint;
      expect(window.getSelection().anchorNode).toBe(five.firstChild);
    });

    it('ignores a drop point outside the editor', () => {
      make('<p>one</p>');
      const p = editor.content.querySelector('p');
      caretInto(p);
      const outside = document.createElement('div');
      outside.textContent = 'o'; document.body.appendChild(outside);
      const point = document.createRange(); point.setStart(outside.firstChild, 0); point.collapse(true);
      document.caretRangeFromPoint = () => point;
      drop({ plain: 'x' });
      delete document.caretRangeFromPoint;
      outside.remove();
      expect(editor.content.contains(window.getSelection().anchorNode)).toBe(true);
    });

    it('a file drop with no text fires no change and reports the files', () => {
      const onChange = vi.fn();
      make('<p>one</p>', { onChange });
      const seen = vi.fn();
      editor.events.on('drop', seen);
      const file = { name: 'a.png' };
      expect(drop({ files: [file] })).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
      expect(seen.mock.calls[0][0].files).toEqual([file]);
    });
  });
});
