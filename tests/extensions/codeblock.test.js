import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { CodeBlock } from '../../src/extensions/blocks/CodeBlock.js';

describe('CodeBlock multi-line round-trip (#40)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function caretInto(node) {
    const r = document.createRange(); r.selectNodeContents(node); r.collapse(false);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  it('preserves <br> line breaks when entering and leaving a code block', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, CodeBlock],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>line1<br>line2</p>',
    });
    caretInto(editor.content.querySelector('p'));

    editor.cmd('toggleCodeBlock');
    const code = editor.content.querySelector('pre code');
    expect(code.textContent).toBe('line1\nline2');     // newlines, not collapsed

    caretInto(editor.content.querySelector('pre'));
    editor.cmd('toggleCodeBlock');
    const p = editor.content.querySelector('p');
    expect(p.querySelectorAll('br').length).toBe(1);    // break restored
    expect(p.textContent).toBe('line1line2');           // (text nodes split by the <br>)
  });
});
