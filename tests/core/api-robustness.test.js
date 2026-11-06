import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Bold } from '../../src/extensions/marks/Bold.js';
import { TaskList } from '../../src/extensions/blocks/TaskList.js';
import { SmartTypography } from '../../src/extensions/plugins/SmartTypography.js';
import * as api from '../../src/index.js';

describe('editor API', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { if (!editor?._destroyed) editor?.destroy(); target.remove(); });
  function make(content = '<p>hi</p>', opts = {}, extensions = [Paragraph, Bold]) {
    editor = new Editor(target, { extensions, toolbar: false, bubbleMenu: false, slashMenu: false, content, ...opts });
  }
  // Browsers dispatch `input` synchronously from execCommand.
  function withBrowserExec(fn) {
    const orig = document.execCommand;
    document.execCommand = () => { editor.content.dispatchEvent(new Event('input', { bubbles: true })); return true; };
    try { fn(); } finally { document.execCommand = orig; }
  }

  describe('one change per edit (#161)', () => {
    it('a format command notifies once when execCommand fires input', () => {
      const onChange = vi.fn();
      make('<p>hi</p>', { onChange });
      withBrowserExec(() => editor.cmd('toggleBold'));
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('a format command still notifies when no input event fires', () => {
      const onChange = vi.fn();
      make('<p>hi</p>', { onChange });
      const orig = document.execCommand;
      document.execCommand = () => true;
      editor.cmd('toggleBold');
      document.execCommand = orig;
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('a paste notifies once and does not run input rules', () => {
      const onChange = vi.fn();
      make('<p>a--</p>', { onChange }, [Paragraph, SmartTypography]);
      const text = editor.content.querySelector('p').firstChild;
      const r = document.createRange(); r.setStart(text, 3); r.collapse(true);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      const e = new Event('paste', { bubbles: true, cancelable: true });
      e.clipboardData = { getData: (t) => (t === 'text/plain' ? 'x' : '') };
      withBrowserExec(() => editor.content.dispatchEvent(e));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(editor.content.textContent).toBe('a--');
    });
  });

  describe('chain proxy (#162)', () => {
    it('can be returned from an async function', async () => {
      make();
      const f = async () => editor.chain();
      const settled = await Promise.race([f().then(() => true), new Promise((r) => setTimeout(() => r(false), 50))]);
      expect(settled).toBe(true);
    });

    it('keeps chaining after the first command', () => {
      make();
      const orig = document.execCommand;
      document.execCommand = () => true;
      expect(() => editor.chain().toggleBold().focus().run()).not.toThrow();
      document.execCommand = orig;
    });

    it('exposes plain properties', () => {
      make();
      expect(editor.chain().editor).toBe(editor);
    });
  });

  describe('setHtml input (#163)', () => {
    it('treats undefined and null as empty', () => {
      make();
      editor.setHtml();
      expect(editor.content.textContent).toBe('');
      editor.setHtml(null);
      expect(editor.content.textContent).toBe('');
    });
  });

  describe('decorations (#164)', () => {
    it('rejects malformed points up front', () => {
      make();
      expect(() => editor.decorations.add({ from: { offset: 0 }, to: { offset: 3 } })).toThrow(TypeError);
      expect(() => editor.decorations.add({ from: { path: [0], offset: 'x' }, to: { path: [0], offset: 0 } })).toThrow(TypeError);
    });
    it('accepts valid points', () => {
      make();
      expect(editor.decorations.add({ from: { path: [0, 0], offset: 0 }, to: { path: [0, 0], offset: 1 } })).toBeTruthy();
    });
  });

  describe('destroy detaches extension listeners (#165)', () => {
    it('a task checkbox on the old element no longer reaches the editor', () => {
      make('<p></p>', {}, [Paragraph, TaskList]);
      const r = document.createRange(); r.selectNodeContents(editor.content.querySelector('p')); r.collapse(true);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      editor.cmd('insertTaskList');
      const content = editor.content;
      const cb = content.querySelector('.rune-task-checkbox');
      const before = cb.textContent;
      editor.destroy();
      cb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(cb.textContent).toBe(before);
      target.appendChild(content);
    });

    it('listen() detaches on destroy', () => {
      make();
      const fn = vi.fn();
      const el = document.createElement('div');
      editor.listen(el, 'x', fn);
      el.dispatchEvent(new Event('x'));
      editor.destroy();
      el.dispatchEvent(new Event('x'));
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('read-only task list (#147)', () => {
    it('does not toggle a checkbox while disabled', () => {
      make('<p></p>', {}, [Paragraph, TaskList]);
      const r = document.createRange(); r.selectNodeContents(editor.content.querySelector('p')); r.collapse(true);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      editor.cmd('insertTaskList');
      const cb = editor.content.querySelector('.rune-task-checkbox');
      const before = cb.textContent;
      editor.disable();
      cb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(cb.textContent).toBe(before);
    });
  });

  describe('public entry (#172)', () => {
    it('does not expose underscore helpers', () => {
      expect(Object.keys(api).filter((k) => k.startsWith('_'))).toEqual([]);
    });
    it('still exposes the sanitizers', () => {
      expect(typeof api.sanitize).toBe('function');
      expect(typeof api.sanitizeContent).toBe('function');
      expect(typeof api.normalizeHtml).toBe('function');
    });
  });
});
