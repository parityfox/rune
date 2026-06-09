import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Highlight } from '../../src/extensions/marks/Highlight.js';
import { TextColor } from '../../src/extensions/marks/TextColor.js';

describe('Highlight + attribute-mark isActive (#87)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function selectRange(node, start, end) {
    const r = document.createRange(); r.setStart(node, start); r.setEnd(node, end);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  it('highlights the selection, reports active state, and unsets', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, Highlight],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>hello world</p>',
    });
    selectRange(editor.content.querySelector('p').firstChild, 0, 5);
    editor.cmd('toggleHighlight', 'green');

    const mark = editor.content.querySelector('mark.rune-hl-green');
    expect(mark).toBeTruthy();
    expect(mark.textContent).toBe('hello');
    expect(editor.isActive('highlight')).toBe(true);   // caret left inside the mark

    editor.cmd('unsetHighlight');
    expect(editor.content.querySelector('mark')).toBeFalsy();
  });

  it('reports textColor active state via hasMark', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, TextColor],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p><span style="color: rgb(224, 62, 62);">red</span> plain</p>',
    });
    const span = editor.content.querySelector('span');
    const r = document.createRange(); r.selectNodeContents(span);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    expect(editor.isActive('textColor')).toBe(true);
  });
});
