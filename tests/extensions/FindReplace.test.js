import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { FindReplace } from '../../src/extensions/plugins/FindReplace.js';

describe('FindReplace replace navigation (#31/#32)', () => {
  let target, editor;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  });
  afterEach(() => {
    editor?.destroy();
    target.remove();
    document.body.querySelectorAll('.rune-fr-panel').forEach(p => p.remove());
  });

  function openPanel() {
    editor.content.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true }));
    return document.body.querySelector('.rune-fr-panel');
  }

  it('Replace advances to the next match instead of resetting to the first', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, FindReplace],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>foo foo foo</p>',
    });
    const panel = openPanel();
    const find = panel.querySelector('.rune-fr-find');
    const count = panel.querySelector('.rune-fr-count');
    const repl = panel.querySelector('.rune-fr-replace');
    const replBtn = [...panel.querySelectorAll('.rune-fr-btn--text')].find(b => b.textContent === 'Replace');

    find.value = 'foo';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    expect(count.textContent).toBe('1/3');

    // Move to the MIDDLE match, then replace it.
    find.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(count.textContent).toBe('2/3');

    repl.value = 'bar';
    replBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    // Middle replaced; active advances to the LAST original match (2/2), not reset to 1/2.
    expect(count.textContent).toBe('2/2');
    expect(editor.getHtml().replace(/<\/?p>/g, '')).toBe('foo bar foo');
  });

  it('keeps getHtml pristine while searching — highlights use the overlay (#82)', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, FindReplace],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>foo foo</p>',
    });
    const panel = openPanel();
    const find = panel.querySelector('.rune-fr-find');
    find.value = 'foo';
    find.dispatchEvent(new Event('input', { bubbles: true }));

    expect(panel.querySelector('.rune-fr-count').textContent).toBe('1/2');
    expect(editor.getHtml()).toBe('<p>foo foo</p>');             // no <mark> injected
    expect(editor.content.querySelector('mark')).toBeFalsy();
  });

  it('Replace All does not re-match its own replacement text (#32)', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, FindReplace],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>a a a</p>',
    });
    const panel = openPanel();
    const find = panel.querySelector('.rune-fr-find');
    const count = panel.querySelector('.rune-fr-count');
    const repl = panel.querySelector('.rune-fr-replace');
    const allBtn = [...panel.querySelectorAll('.rune-fr-btn--text')].find(b => b.textContent === 'All');

    find.value = 'a';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    expect(count.textContent).toBe('1/3');

    repl.value = 'aa';                 // replacement contains the query
    allBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(count.textContent).toBe('0/0');                  // not re-matched into 'aa'
    expect(editor.getHtml().replace(/<\/?p>/g, '')).toBe('aa aa aa');
  });
});
