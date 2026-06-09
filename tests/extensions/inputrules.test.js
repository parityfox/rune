import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';

describe('InputRules engine (#81)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function setCaretText(text, caret) {
    const p = editor.content.querySelector('p');
    p.textContent = text;
    const r = document.createRange();
    r.setStart(p.firstChild, caret); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    editor.content.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  it('fires a text-replace rule on the just-typed tail', () => {
    const Typo = { name: 'typo', type: 'plugin', inputRules: [{ find: /--$/, replace: '—' }] };
    editor = new Editor(target, { extensions: [Paragraph, Typo], toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p></p>' });
    setCaretText('a--', 3);
    expect(editor.content.querySelector('p').textContent).toBe('a—');
  });

  it('does not fire when the match is not at the caret', () => {
    const Typo = { name: 'typo', type: 'plugin', inputRules: [{ find: /--$/, replace: '—' }] };
    editor = new Editor(target, { extensions: [Paragraph, Typo], toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p></p>' });
    setCaretText('a--b', 4);                       // caret after "b", tail isn't "--"
    expect(editor.content.querySelector('p').textContent).toBe('a--b');
  });

  it('runs a custom handler rule (wrap in an element)', () => {
    const Wrap = {
      name: 'wrap', type: 'plugin',
      inputRules: [{
        find: /`([^`]+)`$/,
        handler: ({ match, range }) => {
          range.deleteContents();
          const code = document.createElement('code');
          code.textContent = match[1];
          range.insertNode(code);
        },
      }],
    };
    editor = new Editor(target, { extensions: [Paragraph, Wrap], toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p></p>' });
    setCaretText('say `hi`', 8);
    const code = editor.content.querySelector('code');
    expect(code).toBeTruthy();
    expect(code.textContent).toBe('hi');
    expect(editor.content.querySelector('p').textContent).toBe('say hi');
  });
});
