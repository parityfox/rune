import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Table } from '../../src/extensions/blocks/Table.js';
import { Toggle } from '../../src/extensions/blocks/Toggle.js';

describe('Table keyboard access (#185)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => {
    if (!editor?._destroyed) editor?.destroy();
    target.remove();
    document.querySelectorAll('.rune-table-menu').forEach((m) => m.remove());
  });

  function caretInto(el) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  // A 3 x 3 table of labelled cells, with the caret in row r, column c.
  function make(r = 1, c = 1, { before = '', after = '<p>after</p>' } = {}) {
    const rows = [0, 1, 2].map((y) => {
      const tag = y === 0 ? 'th' : 'td';
      return `<tr>${[0, 1, 2].map((x) => `<${tag} class="rune-table-cell">r${y}c${x}</${tag}>`).join('')}</tr>`;
    });
    editor = new Editor(target, {
      extensions: [Paragraph, Table, Toggle], toolbar: false, bubbleMenu: false, slashMenu: false,
      content: `${before}<table class="rune-table"><thead>${rows[0]}</thead><tbody>${rows[1]}${rows[2]}</tbody></table>${after}`,
    });
    caretInto(cellAt(r, c));
    editor.events.emit('selectionchange', { editor });
  }
  const cellAt = (r, c) => editor.content.querySelectorAll('table tr')[r].children[c];
  const shape = () => {
    const rows = [...editor.content.querySelectorAll('table tr')];
    return rows.length ? `${rows.length}x${rows[0].children.length}` : 'none';
  };
  const caretCell = () => {
    const n = window.getSelection().anchorNode;
    return (n?.nodeType === 1 ? n : n?.parentElement)?.closest?.('th, td')?.textContent ?? null;
  };
  const key = (target_, k, init = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    target_.dispatchEvent(e);
    return e;
  };
  const bar = () => document.querySelector('.rune-table-bar');
  const barBtn = (title) => bar().querySelector(`button[title="${title}"]`);
  const menu = () => document.querySelector('.rune-table-menu');
  const menuItem = (label) => [...menu().querySelectorAll('button')].find((b) => b.textContent === label);

  describe('commands', () => {
    it('insert rows and columns around the caret cell', () => {
      make();
      editor.cmd('insertRowAfter');
      expect(shape()).toBe('4x3');
      expect(cellAt(2, 0).textContent).toBe('');
      editor.cmd('insertRowBefore');
      expect(shape()).toBe('5x3');
      editor.cmd('insertColumnAfter');
      expect(shape()).toBe('5x4');
      editor.cmd('insertColumnBefore');
      expect(shape()).toBe('5x5');
    });

    it('deleteRow keeps the caret in the same column of the next row', () => {
      make(1, 1);
      editor.cmd('deleteRow');
      expect(shape()).toBe('2x3');
      expect(caretCell()).toBe('r2c1');
    });

    it('deleteRow on the last row moves up', () => {
      make(2, 2);
      editor.cmd('deleteRow');
      expect(caretCell()).toBe('r1c2');
    });

    it('deleteRow on the header promotes the next row and keeps a caret', () => {
      make(0, 1);
      editor.cmd('deleteRow');
      expect(cellAt(0, 0).tagName).toBe('TH');
      expect(caretCell()).toBe('r1c1');
    });

    it('deleteColumn keeps the caret in the same row', () => {
      make(1, 1);
      editor.cmd('deleteColumn');
      expect(shape()).toBe('3x2');
      expect(caretCell()).toBe('r1c2');
    });

    it('deleteColumn on the last column moves left', () => {
      make(1, 2);
      editor.cmd('deleteColumn');
      expect(caretCell()).toBe('r1c1');
    });

    it('deleteTable leaves the caret in the block before it', () => {
      make(1, 1, { before: '<p>before</p>' });
      editor.cmd('deleteTable');
      expect(shape()).toBe('none');
      expect(window.getSelection().anchorNode.textContent).toBe('before');
    });

    it('deleteTable with nothing before it moves to the block after it', () => {
      make(1, 1);
      editor.cmd('deleteTable');
      expect(editor.content.contains(window.getSelection().anchorNode)).toBe(true);
      expect(window.getSelection().anchorNode.textContent).toBe('after');
    });

    it('deleteTable as the only block leaves an editable paragraph', () => {
      make(1, 1, { after: '' });
      editor.cmd('deleteTable');
      expect(editor.content.querySelector('p')).toBeTruthy();
    });

    it('deleteTable inside a toggle leaves the toggle editable', () => {
      make(1, 1);
      const body = document.createElement('div');
      body.className = 'rune-toggle-body';
      const wrap = document.createElement('div');
      wrap.className = 'rune-toggle';
      wrap.dataset.type = 'toggle';
      wrap.appendChild(body);
      editor.content.prepend(wrap);
      body.appendChild(editor.content.querySelector('table'));
      caretInto(cellAt(1, 1));
      editor.cmd('deleteTable');
      expect(body.querySelector('p')).toBeTruthy();
    });

    it('do nothing and report false outside a table', () => {
      make();
      caretInto(editor.content.querySelector('p'));
      for (const name of ['insertRowBefore', 'insertRowAfter', 'insertColumnBefore', 'insertColumnAfter', 'deleteRow', 'deleteColumn', 'deleteTable']) {
        expect(editor.cmd(name)).toBe(false);
      }
      expect(shape()).toBe('3x3');
    });

    it('are undoable', () => {
      make();
      editor.cmd('deleteRow');
      editor.history.undo();
      expect(shape()).toBe('3x3');
    });
  });

  describe('table bar', () => {
    const enter = () => key(cellAt(1, 1), 'F10', { altKey: true });

    it('Alt+F10 moves focus to the first button', () => {
      make();
      expect(enter().defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(bar().querySelector('button'));
    });

    it('Alt+F10 does nothing outside a table', () => {
      make();
      caretInto(editor.content.querySelector('p'));
      key(editor.content.querySelector('p'), 'F10', { altKey: true });
      expect(bar().contains(document.activeElement)).toBe(false);
    });

    it('uses one tab stop, with arrow keys, Home and End between buttons', () => {
      make();
      enter();
      const btns = [...bar().querySelectorAll('button')];
      expect(btns.filter((b) => b.getAttribute('tabindex') === '0').length).toBe(1);
      key(document.activeElement, 'ArrowRight');
      expect(document.activeElement).toBe(btns[1]);
      key(document.activeElement, 'ArrowLeft');
      key(document.activeElement, 'ArrowLeft');
      expect(document.activeElement).toBe(btns[btns.length - 1]);
      key(document.activeElement, 'Home');
      expect(document.activeElement).toBe(btns[0]);
      key(document.activeElement, 'End');
      expect(document.activeElement).toBe(btns[btns.length - 1]);
    });

    for (const k of ['Escape', 'Tab']) {
      it(`${k} returns to the cell without changing anything`, () => {
        make();
        enter();
        const e = key(document.activeElement, k);
        expect(e.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(editor.content);
        expect(caretCell()).toBe('r1c1');
        expect(shape()).toBe('3x3');
      });
    }

    it('click acts on the caret cell once and returns focus to it', () => {
      make();
      enter();
      barBtn('Insert row below').focus();
      barBtn('Insert row below').click();
      expect(shape()).toBe('4x3');
      expect(document.activeElement).toBe(editor.content);
      expect(caretCell()).toBe('r1c1');
    });

    it('still acts when focus on the bar has lost the selection', () => {
      make();
      enter();
      window.getSelection().removeAllRanges();
      barBtn('Delete row').click();
      expect(shape()).toBe('2x3');
      expect(caretCell()).toBe('r2c1');
    });

    it('stays visible while it holds focus', () => {
      make();
      enter();
      window.getSelection().removeAllRanges();
      editor.events.emit('selectionchange', { editor });
      expect(bar().style.display).not.toBe('none');
    });

    it('a mouse press only keeps the selection', () => {
      make();
      const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      barBtn('Delete row').dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
      expect(shape()).toBe('3x3');
    });

    it('a mouse delete still leaves the caret in the table', () => {
      make();
      barBtn('Delete row').click();
      expect(caretCell()).toBe('r2c1');
    });
  });

  describe('context menu', () => {
    const open = async (k = 'ContextMenu', init = {}) => {
      const e = key(cellAt(1, 1), k, init);
      await frame();
      return e;
    };

    for (const [label, k, init] of [['the Menu key', 'ContextMenu', {}], ['Shift+F10', 'F10', { shiftKey: true }]]) {
      it(`${label} opens it and focuses the first item`, async () => {
        make();
        expect((await open(k, init)).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(menu().querySelector('button'));
      });
    }

    it('does not open outside a table', async () => {
      make();
      caretInto(editor.content.querySelector('p'));
      key(editor.content.querySelector('p'), 'ContextMenu');
      await frame();
      expect(menu()).toBeNull();
    });

    it('exposes menu roles', async () => {
      make();
      await open();
      expect(menu().getAttribute('role')).toBe('menu');
      expect(menu().querySelector('button').getAttribute('role')).toBe('menuitem');
    });

    it('arrow keys wrap, and Home and End jump', async () => {
      make();
      await open();
      const items = [...menu().querySelectorAll('button')];
      key(document.activeElement, 'ArrowDown');
      expect(document.activeElement).toBe(items[1]);
      key(document.activeElement, 'ArrowUp');
      key(document.activeElement, 'ArrowUp');
      expect(document.activeElement).toBe(items[items.length - 1]);
      key(document.activeElement, 'ArrowDown');
      expect(document.activeElement).toBe(items[0]);
      key(document.activeElement, 'End');
      expect(document.activeElement).toBe(items[items.length - 1]);
      key(document.activeElement, 'Home');
      expect(document.activeElement).toBe(items[0]);
    });

    for (const k of ['Escape', 'Tab']) {
      it(`${k} closes it and returns to the cell`, async () => {
        make();
        await open();
        key(document.activeElement, k);
        expect(menu()).toBeNull();
        expect(document.activeElement).toBe(editor.content);
        expect(caretCell()).toBe('r1c1');
      });
    }

    it('click acts once, closes, and returns focus to the table', async () => {
      make();
      await open();
      menuItem('Delete column').focus();
      menuItem('Delete column').click();
      expect(shape()).toBe('3x2');
      expect(menu()).toBeNull();
      expect(document.activeElement).toBe(editor.content);
      expect(caretCell()).toBe('r1c2');
    });

    it('a mouse press on an item only keeps the selection', async () => {
      make();
      await open();
      const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      menuItem('Delete row').dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
      expect(shape()).toBe('3x3');
      expect(menu()).toBeTruthy();
    });

    it('a right click can then be driven with arrow keys', async () => {
      make();
      cellAt(1, 1).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
      await frame();
      expect(menu().contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(menu());
      key(document.activeElement, 'ArrowDown');
      expect(document.activeElement).toBe(menu().querySelector('button'));
    });

    it('a mouse press elsewhere closes it without moving focus to the cell', async () => {
      make();
      await open();
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(menu()).toBeNull();
      expect(document.activeElement).not.toBe(editor.content);
      outside.remove();
    });

    it('destroy removes it', async () => {
      make();
      await open();
      editor.destroy();
      expect(menu()).toBeNull();
    });
  });

  describe('on a disabled editor', () => {
    it('hides the bar', () => {
      make();
      editor.disable();
      editor.events.emit('selectionchange', { editor });
      expect(bar().style.display).toBe('none');
    });

    it('Alt+F10 does nothing', () => {
      make();
      editor.disable();
      key(cellAt(1, 1), 'F10', { altKey: true });
      expect(bar().contains(document.activeElement)).toBe(false);
    });

    it('opens no context menu by key or right click', async () => {
      make();
      editor.disable();
      key(cellAt(1, 1), 'ContextMenu');
      cellAt(1, 1).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      await frame();
      expect(menu()).toBeNull();
    });

    it('a menu left open when disabled changes nothing', async () => {
      make();
      key(cellAt(1, 1), 'ContextMenu');
      await frame();
      const item = menuItem('Delete row');
      editor.disable();
      item.click();
      expect(shape()).toBe('3x3');
    });

    it('hides the edge add buttons', () => {
      make();
      editor.disable();
      editor.events.emit('selectionchange', { editor });
      for (const b of document.querySelectorAll('.rune-table-add-btn')) expect(b.style.display).toBe('none');
    });
  });
});
