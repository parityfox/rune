import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { Emoji } from '../../src/extensions/plugins/Emoji.js';
import { Mention } from '../../src/extensions/marks/Mention.js';
import { Suggestion } from '../../src/ui/Suggestion.js';

describe('Suggestion controller (#80)', () => {
  let target, editor, sug;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => {
    sug?.destroy(); editor?.destroy(); target.remove();
    document.body.querySelectorAll('.rune-suggestion-menu').forEach(m => m.remove());
  });

  function build(opts) {
    editor = new Editor(target, { toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p></p>', ...opts });
    sug = new Suggestion(editor, editor.schema.getSuggestions());
  }
  function type(text, caret = text.length) {
    const p = editor.content.querySelector('p');
    p.textContent = text;
    const r = document.createRange(); r.setStart(p.firstChild, caret); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    editor.content.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
  const menu = () => document.querySelector('.rune-suggestion-menu');
  const enter = () => editor.content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

  it(':emoji shows a menu and Enter inserts the emoji', async () => {
    build({ extensions: [Paragraph, Emoji] });
    type(':smi');
    await Promise.resolve();                       // items() resolves on a microtask
    expect(menu().style.display).toBe('block');
    expect(menu().querySelectorAll('.rune-suggestion-item').length).toBeGreaterThan(0);
    enter();
    expect(editor.content.querySelector('p').textContent).toContain('😄');
  });

  it('@mention uses fetchMentions and inserts a chip', async () => {
    build({ extensions: [Paragraph, Mention], fetchMentions: async () => [{ id: '1', label: 'Ada' }, { id: '2', label: 'Alan' }] });
    type('@a');
    await new Promise((r) => setTimeout(r, 0));    // async fetch
    expect(menu().style.display).toBe('block');
    enter();
    const chip = editor.content.querySelector('.rune-mention');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toBe('@Ada');
    expect(chip.getAttribute('data-id')).toBe('1');
  });

  it('does not trigger when the char is not at start/after-space', async () => {
    build({ extensions: [Paragraph, Emoji] });
    type('http://x');                              // the ":" is mid-word
    await Promise.resolve();
    expect(menu().style.display).toBe('none');
  });
});
