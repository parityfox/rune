import { describe, it, expect, vi, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Callout } from '../../src/extensions/blocks/Callout.js';
import { Image } from '../../src/extensions/blocks/Image.js';
import { FontFamily } from '../../src/extensions/marks/FontFamily.js';
import { FontSize } from '../../src/extensions/marks/FontSize.js';
import { TextBackground } from '../../src/extensions/marks/TextBackground.js';
import { TextColor } from '../../src/extensions/marks/TextColor.js';
import { Highlight } from '../../src/extensions/marks/Highlight.js';
import { Emoji } from '../../src/extensions/plugins/Emoji.js';
import { TextAlign } from '../../src/extensions/formatting/TextAlign.js';
import { VideoEmbed } from '../../src/extensions/blocks/VideoEmbed.js';
import { Table } from '../../src/extensions/blocks/Table.js';

// Enter and Space dispatch `click`, so every panel option must act on click. The
// mousedown must only keep the selection, or a mouse press would act twice.
describe('panel options work from the keyboard (#184)', () => {
  let target, editor;
  afterEach(() => { editor?.destroy(); target?.remove(); });

  function open(ext) {
    target = document.createElement('div'); document.body.appendChild(target);
    editor = new Editor(target, { extensions: [Paragraph, ext], toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p>hello</p>' });
    const r = document.createRange(); r.selectNodeContents(editor.content.querySelector('p'));
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    const cmd = vi.spyOn(editor, 'cmd').mockImplementation(() => {});
    const close = vi.fn();
    const panel = ext.toolbarItem.renderPanel(editor, close, ext.toolbarItem);
    return { panel, cmd, close };
  }
  const press = (btn) => {
    const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    btn.dispatchEvent(e);
    return e;
  };

  const cases = [
    ['FontFamily', FontFamily, (p) => p.querySelector('.rune-panel-font-item'), 'setFontFamily'],
    ['FontSize row', FontSize, (p) => p.querySelector('.rune-panel-size-item'), 'setFontSize'],
    ['TextBackground', TextBackground, (p) => p.querySelector('.rune-color-swatch'), 'setTextBackground'],
    ['TextColor', TextColor, (p) => p.querySelector('.rune-color-swatch'), 'setTextColor'],
    ['Highlight none', Highlight, (p) => p.querySelector('.rune-color-swatch.is-default'), 'unsetHighlight'],
    ['Highlight color', Highlight, (p) => p.querySelector('.rune-color-swatch:not(.is-default)'), 'toggleHighlight'],
    ['Emoji', Emoji, (p) => p.querySelector('.rune-panel-emoji-btn'), 'insertEmoji'],
    ['TextAlign', TextAlign, (p) => p.querySelector('.rune-panel-align-btn'), 'setTextAlign'],
  ];

  for (const [name, ext, find, command] of cases) {
    it(`${name} acts once on click and closes`, () => {
      const { panel, cmd, close } = open(ext);
      find(panel).click();
      expect(cmd).toHaveBeenCalledTimes(1);
      expect(cmd.mock.calls[0][0]).toBe(command);
      expect(close).toHaveBeenCalledTimes(1);
    });

    it(`${name} only keeps the selection on mousedown`, () => {
      const { panel, cmd } = open(ext);
      expect(press(find(panel)).defaultPrevented).toBe(true);
      expect(cmd).not.toHaveBeenCalled();
    });
  }

  it('FontSize Apply uses the typed size', () => {
    const { panel, cmd, close } = open(FontSize);
    panel.querySelector('input').value = '24';
    panel.querySelector('.rune-panel-btn-primary').click();
    expect(cmd).toHaveBeenCalledWith('setFontSize', '24px');
    expect(close).toHaveBeenCalled();
  });

  it('FontSize Apply ignores an out-of-range size', () => {
    const { panel, cmd } = open(FontSize);
    panel.querySelector('input').value = '2';
    panel.querySelector('.rune-panel-btn-primary').click();
    expect(cmd).not.toHaveBeenCalled();
  });

  it('Image Insert uses the typed URL', () => {
    const { panel, cmd, close } = open(Image);
    panel.querySelector('.rune-panel-url-row input').value = ' https://a.com/x.png ';
    panel.querySelector('.rune-panel-url-row button').click();
    expect(cmd).toHaveBeenCalledWith('insertImage', 'https://a.com/x.png');
    expect(close).toHaveBeenCalled();
  });

  it('Image Insert does nothing with no URL', () => {
    const { panel, cmd } = open(Image);
    panel.querySelector('.rune-panel-url-row button').click();
    expect(cmd).not.toHaveBeenCalled();
  });

  it('Callout emoji and color are chosen by click, then inserted', () => {
    const { panel, cmd, close } = open(Callout);
    const emoji = panel.querySelectorAll('.rune-panel-emoji-btn')[2];
    const color = panel.querySelectorAll('.rune-panel-callout-color')[1];
    emoji.click();
    color.click();
    expect(emoji.classList.contains('is-active')).toBe(true);
    expect(color.classList.contains('is-active')).toBe(true);
    expect(panel.querySelectorAll('.rune-panel-emoji-btn.is-active').length).toBe(1);
    expect(cmd).not.toHaveBeenCalled();
    panel.querySelector('.rune-panel-btn-primary').click();
    expect(cmd).toHaveBeenCalledTimes(1);
    expect(cmd.mock.calls[0][0]).toBe('insertCallout');
    expect(cmd.mock.calls[0][1]).toBe(emoji.textContent);
    expect(close).toHaveBeenCalled();
  });

  it('VideoEmbed Embed uses the typed URL', () => {
    const { panel, cmd, close } = open(VideoEmbed);
    panel.querySelector('input').value = 'https://youtu.be/abc';
    panel.querySelector('.rune-panel-btn-primary').click();
    expect(cmd).toHaveBeenCalledWith('insertVideo', 'https://youtu.be/abc');
    expect(close).toHaveBeenCalled();
  });

  describe('Table size grid', () => {
    const cellAt = (panel, r, c) => panel.querySelector(`[data-r="${r}"][data-c="${c}"]`);

    it('cells are focusable buttons with a spoken size', () => {
      const { panel } = open(Table);
      const cell = cellAt(panel, 1, 2);
      expect(cell.tagName).toBe('BUTTON');
      expect(cell.getAttribute('aria-label')).toBe('3 columns by 2 rows');
    });

    it('click inserts that size and closes', () => {
      const { panel, cmd, close } = open(Table);
      cellAt(panel, 1, 2).click();
      expect(cmd).toHaveBeenCalledWith('insertTable', 2, 3);
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('mousedown only keeps the selection', () => {
      const { panel, cmd } = open(Table);
      expect(press(cellAt(panel, 0, 0)).defaultPrevented).toBe(true);
      expect(cmd).not.toHaveBeenCalled();
    });

    it('arrow keys move between cells and stop at the edges', () => {
      const { panel } = open(Table);
      document.body.appendChild(panel);
      const key = (k) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      cellAt(panel, 0, 0).focus();
      key('ArrowRight'); key('ArrowDown');
      expect(document.activeElement).toBe(cellAt(panel, 1, 1));
      key('ArrowUp'); key('ArrowUp'); key('ArrowLeft'); key('ArrowLeft');
      expect(document.activeElement).toBe(cellAt(panel, 0, 0));
      panel.remove();
    });

    it('focus highlights the size, like hovering', () => {
      const { panel } = open(Table);
      document.body.appendChild(panel);
      cellAt(panel, 1, 1).focus();
      expect(panel.querySelectorAll('.is-on').length).toBe(4);
      expect(panel.textContent).toContain('2 × 2');
      panel.remove();
    });
  });
});
