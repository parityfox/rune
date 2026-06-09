import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Heading } from '../../src/extensions/blocks/Heading.js';
import { MarkdownShortcuts } from '../../src/extensions/plugins/MarkdownShortcuts.js';

describe('MarkdownShortcuts caret guard (#41)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  const makeEd = (content) => new Editor(target, {
    extensions: [Paragraph, Heading, MarkdownShortcuts],
    toolbar: false, bubbleMenu: false, slashMenu: false, content,
  });
  const setCaret = (node, toEnd) => {
    const r = document.createRange(); r.selectNodeContents(node); r.collapse(!toEnd);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  };
  const space = () => editor.content.dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));

  it('converts "#" to a heading when the caret is at the block end', () => {
    editor = makeEd('<p>#</p>');
    setCaret(editor.content.querySelector('p'), true);
    space();
    expect(editor.content.querySelector('h1')).toBeTruthy();
  });

  it('does NOT convert when the caret is not at the block end', () => {
    editor = makeEd('<p>#</p>');
    setCaret(editor.content.querySelector('p'), false);   // caret before the "#"
    space();
    expect(editor.content.querySelector('h1')).toBeFalsy();
  });
});
