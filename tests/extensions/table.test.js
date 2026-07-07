import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Table } from '../../src/extensions/blocks/Table.js';

describe('Table', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); editor = null; });

  function make() {
    editor = new Editor(target, { extensions: [Paragraph, Table], toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p></p>' });
    const p = editor.content.querySelector('p');
    const r = document.createRange(); r.selectNodeContents(p); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  it('right-click on a cell opens the context menu', () => {
    make();
    editor.cmd('insertTable', 2, 2);
    const cell = editor.content.querySelector('th, td');
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(document.querySelector('.rune-table-menu')).toBeTruthy();
    document.querySelector('.rune-table-menu')?.remove();
  });

  // #118: the contextmenu/mouseover/mouseout listeners live on editor.content,
  // which a host may keep and reuse after destroy() — they must be detached.
  it('detaches content-level listeners on destroy (#118)', () => {
    make();
    editor.cmd('insertTable', 2, 2);
    const cell = editor.content.querySelector('th, td');
    editor.destroy();
    editor = null;

    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(document.querySelector('.rune-table-menu')).toBeFalsy();
  });
});
