import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Bold } from '../../src/extensions/marks/Bold.js';
import { TextColor } from '../../src/extensions/marks/TextColor.js';
import { FontFamily } from '../../src/extensions/marks/FontFamily.js';
import { FontSize } from '../../src/extensions/marks/FontSize.js';
import { TextBackground } from '../../src/extensions/marks/TextBackground.js';

describe('"Default" on color and font', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });
  const clean = (h) => h.replace(/ data-id="[^"]*"/g, '');
  function make(content) {
    editor = new Editor(target, { extensions: [Paragraph, Bold, TextColor, FontFamily, FontSize, TextBackground], toolbar: false, bubbleMenu: false, slashMenu: false, content });
  }
  function select(n, a, b) {
    const r = document.createRange(); r.setStart(n, a); r.setEnd(n, b);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  it('TextColor keeps bold around a fully selected colored span (#158)', () => {
    make('<p><strong><span style="color: red;">text</span></strong></p>');
    const t = editor.content.querySelector('span').firstChild;
    select(t, 0, 4);
    editor.cmd('setTextColor', 'inherit');
    expect(clean(editor.getHtml())).toBe('<p><strong>text</strong></p>');
  });

  it('TextColor clears only the selected part of a colored span (#158)', () => {
    make('<p><span style="color: red;">abcd</span></p>');
    select(editor.content.querySelector('span').firstChild, 1, 3);
    editor.cmd('setTextColor', 'inherit');
    expect(clean(editor.getHtml())).toBe('<p><span style="color: red;">a</span>bc<span style="color: red;">d</span></p>');
  });

  it('TextColor keeps a mark inside the colored span (#158)', () => {
    make('<p><span style="color: red;"><strong>abcd</strong></span></p>');
    select(editor.content.querySelector('strong').firstChild, 1, 3);
    editor.cmd('setTextColor', 'inherit');
    expect(editor.content.querySelectorAll('strong').length).toBe(3);
    expect(editor.content.textContent).toBe('abcd');
  });

  it('FontFamily clears a word selected inside one text node (#159)', () => {
    make('<p><span style="font-family: Georgia;">word</span></p>');
    select(editor.content.querySelector('span').firstChild, 0, 4);
    editor.cmd('setFontFamily', 'inherit');
    expect(clean(editor.getHtml())).toBe('<p>word</p>');
  });

  it('FontFamily leaves other styled spans in the paragraph alone (#159)', () => {
    make('<p><span style="font-family: Georgia;">a</span> <span style="font-family: Arial;">b</span></p>');
    select(editor.content.querySelector('span').firstChild, 0, 1);
    editor.cmd('setFontFamily', 'inherit');
    expect(clean(editor.getHtml())).toBe('<p>a <span style="font-family: Arial;">b</span></p>');
  });

  describe('background and font size (#183)', () => {
    it('TextBackground clears a fully selected span', () => {
      make('<p><span style="background-color: yellow;">word</span></p>');
      select(editor.content.querySelector('span').firstChild, 0, 4);
      editor.cmd('setTextBackground', 'transparent');
      expect(clean(editor.getHtml())).toBe('<p>word</p>');
    });

    it('TextBackground clears the background shorthand', () => {
      make('<p><span style="background: yellow;">word</span></p>');
      select(editor.content.querySelector('span').firstChild, 0, 4);
      editor.cmd('setTextBackground', 'transparent');
      expect(clean(editor.getHtml())).toBe('<p>word</p>');
    });

    it('TextBackground clears only the selected part', () => {
      make('<p><span style="background-color: yellow;">abcd</span></p>');
      select(editor.content.querySelector('span').firstChild, 1, 3);
      editor.cmd('setTextBackground', 'transparent');
      expect(clean(editor.getHtml())).toBe('<p><span style="background-color: yellow;">a</span>bc<span style="background-color: yellow;">d</span></p>');
    });

    it('clearFontSize clears a fully selected span', () => {
      make('<p><span style="font-size: 2em;">word</span></p>');
      select(editor.content.querySelector('span').firstChild, 0, 4);
      editor.cmd('clearFontSize');
      expect(clean(editor.getHtml())).toBe('<p>word</p>');
    });

    it('clearFontSize clears only the selected part', () => {
      make('<p><span style="font-size: 2em;">abcd</span></p>');
      select(editor.content.querySelector('span').firstChild, 1, 3);
      editor.cmd('clearFontSize');
      expect(clean(editor.getHtml())).toBe('<p><span style="font-size: 2em;">a</span>bc<span style="font-size: 2em;">d</span></p>');
    });
  });

  describe('a span with several styles', () => {
    it('keeps the other styles on the selected text', () => {
      make('<p><span style="color: red; font-size: 2em;">abcd</span></p>');
      select(editor.content.querySelector('span').firstChild, 1, 3);
      editor.cmd('setTextColor', 'inherit');
      const spans = [...editor.content.querySelectorAll('span')];
      expect(editor.content.textContent).toBe('abcd');
      expect(spans.map((s) => s.textContent)).toEqual(['a', 'bc', 'd']);
      expect(spans[1].style.color).toBe('');
      expect(spans[1].style.fontSize).toBe('2em');
      expect(spans[0].style.color).toBe('red');
    });
  });
});
