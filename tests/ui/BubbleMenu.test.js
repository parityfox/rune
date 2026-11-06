import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BubbleMenu } from '../../src/ui/BubbleMenu.js';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Bold } from '../../src/extensions/marks/Bold.js';
import { Italic } from '../../src/extensions/marks/Italic.js';
import { TextColor } from '../../src/extensions/marks/TextColor.js';

describe('BubbleMenu', () => {
  let cleanups;
  beforeEach(() => { cleanups = []; });
  afterEach(() => { cleanups.forEach((f) => f()); window.getSelection().removeAllRanges(); });

  function make({ items, content = '<p>hello world</p>' } = {}) {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const editor = new Editor(target, {
      extensions: [Paragraph, Bold, Italic, TextColor], toolbar: false, slashMenu: false, content,
      bubbleMenu: items ? { items } : false,
    });
    const menu = new BubbleMenu(editor);
    cleanups.push(() => { menu.destroy(); if (!editor._destroyed) editor.destroy(); target.remove(); });
    return { editor, menu };
  }
  function selectText(editor, a = 0, b = 5) {
    const t = editor.content.querySelector('p').firstChild;
    const r = document.createRange(); r.setStart(t, a); r.setEnd(t, b);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    editor.events.emit('selectionchange', { editor });
  }
  const visible = (menu) => menu.el.classList.contains('is-visible');

  it('shows for a selection inside the editor', () => {
    const { editor, menu } = make();
    selectText(editor);
    expect(visible(menu)).toBe(true);
    expect(menu.el.style.display).toBe('flex');
  });

  it('hides when the selection collapses', () => {
    const { editor, menu } = make();
    selectText(editor);
    selectText(editor, 2, 2);
    expect(visible(menu)).toBe(false);
  });

  it('stays hidden for a selection outside the editor', () => {
    const { editor, menu } = make();
    const outside = document.createElement('p');
    outside.textContent = 'elsewhere';
    document.body.appendChild(outside);
    cleanups.push(() => outside.remove());
    const r = document.createRange(); r.selectNodeContents(outside);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    editor.events.emit('selectionchange', { editor });
    expect(visible(menu)).toBe(false);
  });

  it('stays hidden while the format painter is armed', () => {
    const { editor, menu } = make();
    editor.content.classList.add('rune-painter-active');
    selectText(editor);
    expect(visible(menu)).toBe(false);
  });

  it('stays hidden on a disabled editor', () => {
    const { editor, menu } = make();
    editor.disable();
    selectText(editor);
    expect(visible(menu)).toBe(false);
  });

  it('renders configured items and dividers, and skips unknown ones', () => {
    const { menu } = make({ items: ['bold', '|', 'nope', 'italic'] });
    expect(menu.el.querySelectorAll('.rune-bubble-btn').length).toBe(2);
    expect(menu.el.querySelectorAll('.rune-bubble-divider').length).toBe(1);
  });

  it('runs the command on click, so keyboard activation works', () => {
    const { editor, menu } = make({ items: ['bold'] });
    const spy = vi.spyOn(editor, 'cmd').mockImplementation(() => {});
    menu.el.querySelector('button').click();
    expect(spy).toHaveBeenCalledWith('toggleBold');
  });

  it('keeps the selection when a button is pressed', () => {
    const { menu } = make({ items: ['bold'] });
    const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    menu.el.querySelector('button').dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('reflects the active state of the selection', () => {
    const { editor, menu } = make({ items: ['bold'], content: '<p><strong>hello</strong> world</p>' });
    const t = editor.content.querySelector('strong').firstChild;
    const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 5);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    editor.events.emit('selectionchange', { editor });
    expect(menu.el.querySelector('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps two editors from updating each other\'s buttons', () => {
    const a = make({ items: ['bold'], content: '<p><strong>hello</strong></p>' });
    const b = make({ items: ['bold'], content: '<p>plain</p>' });
    const t = a.editor.content.querySelector('strong').firstChild;
    const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 5);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    a.editor.events.emit('selectionchange', { editor: a.editor });
    expect(a.menu.el.querySelector('button').getAttribute('aria-pressed')).toBe('true');
    expect(b.menu.el.querySelector('button').getAttribute('aria-pressed')).toBe('false');
  });

  describe('panel items', () => {
    const open = (menu) => { menu.el.querySelector('button').click(); return document.querySelector('.rune-popup-panel'); };
    afterEach(() => document.querySelectorAll('.rune-popup-panel').forEach((p) => p.remove()));

    it('opens a popup and marks the button expanded', () => {
      const { menu } = make({ items: ['textColor'] });
      expect(open(menu)).toBeTruthy();
      expect(menu.el.querySelector('button').getAttribute('aria-expanded')).toBe('true');
    });

    it('a second click closes it', () => {
      const { menu } = make({ items: ['textColor'] });
      open(menu);
      menu.el.querySelector('button').click();
      expect(menu._popup).toBeNull();
      expect(menu.el.querySelector('button').getAttribute('aria-expanded')).toBe('false');
    });

    it('Escape closes it and returns focus to the button', () => {
      const { menu } = make({ items: ['textColor'] });
      const popup = open(menu);
      popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(menu._popup).toBeNull();
      expect(document.activeElement).toBe(menu.el.querySelector('button'));
    });

    it('an outside press closes it', () => {
      const { menu } = make({ items: ['textColor'] });
      open(menu);
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(menu._popup).toBeNull();
    });

    it('hiding the menu closes it', () => {
      const { editor, menu } = make({ items: ['textColor'] });
      selectText(editor);
      open(menu);
      selectText(editor, 1, 1);
      expect(menu._popup).toBeNull();
    });
  });

  it('destroy removes the element and stops reacting', () => {
    const { editor, menu } = make();
    menu.destroy();
    expect(document.body.contains(menu.el)).toBe(false);
    expect(() => selectText(editor)).not.toThrow();
    expect(visible(menu)).toBe(false);
  });
});
