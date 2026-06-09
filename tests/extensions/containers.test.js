import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Toggle } from '../../src/extensions/blocks/Toggle.js';
import { Columns } from '../../src/extensions/blocks/Columns.js';

describe('Container blocks: Toggle + Columns (#88)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function caretInto(el) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function make(extensions) {
    editor = new Editor(target, { extensions, toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p></p>' });
    caretInto(editor.content.querySelector('p'));
  }

  it('insertToggle builds a collapsible structure', () => {
    make([Paragraph, Toggle]);
    editor.cmd('insertToggle');
    const t = editor.content.querySelector('.rune-toggle');
    expect(t).toBeTruthy();
    expect(t.classList.contains('is-open')).toBe(true);
    expect(t.querySelector('.rune-toggle-title')).toBeTruthy();
    expect(t.querySelector('.rune-toggle-body > p')).toBeTruthy();
  });

  it('clicking the arrow collapses and expands', () => {
    make([Paragraph, Toggle]);
    editor.cmd('insertToggle');
    const t = editor.content.querySelector('.rune-toggle');
    const arrow = t.querySelector('.rune-toggle-arrow');
    arrow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(t.classList.contains('is-open')).toBe(false);
    arrow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(t.classList.contains('is-open')).toBe(true);
  });

  it('getBlock targets the inner block inside a toggle body, not the container', () => {
    make([Paragraph, Toggle]);
    editor.cmd('insertToggle');
    const bodyP = editor.content.querySelector('.rune-toggle-body > p');
    caretInto(bodyP);
    expect(editor.selection.getBlock()).toBe(bodyP);
  });

  it('insertColumns builds N columns, each with a block', () => {
    make([Paragraph, Columns]);
    editor.cmd('insertColumns', 3);
    const cols = editor.content.querySelectorAll('.rune-columns > .rune-column');
    expect(cols.length).toBe(3);
    cols.forEach((c) => expect(c.querySelector('p')).toBeTruthy());
  });

  it('survives a getHtml -> setHtml round trip', () => {
    make([Paragraph, Toggle]);
    editor.cmd('insertToggle');
    editor.setHtml(editor.getHtml());
    const t = editor.content.querySelector('.rune-toggle');
    expect(t).toBeTruthy();
    expect(t.querySelector('.rune-toggle-body > p')).toBeTruthy();
    expect(t.querySelector('.rune-toggle-arrow')?.getAttribute('contenteditable')).toBe('false');
  });
});
