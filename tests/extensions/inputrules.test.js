import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { CodeBlock } from '../../src/extensions/blocks/CodeBlock.js';
import { SmartTypography } from '../../src/extensions/plugins/SmartTypography.js';
import { InlineMarkdown } from '../../src/extensions/plugins/InlineMarkdown.js';
import { runPasteRules } from '../../src/core/InputRules.js';

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

describe('SmartTypography + InlineMarkdown (#81)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  function type(text, caret, extensions) {
    editor = new Editor(target, { extensions, toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p></p>' });
    const p = editor.content.querySelector('p');
    p.textContent = text;
    const r = document.createRange();
    r.setStart(p.firstChild, caret); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    editor.content.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return p;
  }

  it('SmartTypography: -- → em dash', () => {
    expect(type('a--', 3, [Paragraph, SmartTypography]).textContent).toBe('a—');
  });
  it('SmartTypography: (c) → ©', () => {
    expect(type('see (c)', 7, [Paragraph, SmartTypography]).textContent).toBe('see ©');
  });

  it('InlineMarkdown: **bold** → <strong>', () => {
    const p = type('**bold**', 8, [Paragraph, InlineMarkdown]);
    expect(p.querySelector('strong')?.textContent).toBe('bold');
  });
  it('InlineMarkdown: *italic* → <em> (not triggered inside **)', () => {
    const p = type('*it*', 4, [Paragraph, InlineMarkdown]);
    expect(p.querySelector('em')?.textContent).toBe('it');
    expect(p.querySelector('strong')).toBeFalsy();
  });
  it('InlineMarkdown: `code` → <code>', () => {
    const p = type('`x`', 3, [Paragraph, InlineMarkdown]);
    expect(p.querySelector('code')?.textContent).toBe('x');
  });

  // #119: code content must stay literal — the block path (MarkdownShortcuts)
  // already guards PRE; the inline input-rule path needs the same guard.
  it('InlineMarkdown does not fire inside a code block (#119)', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, CodeBlock, InlineMarkdown],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<pre>x</pre>',
    });
    const pre = editor.content.querySelector('pre');
    pre.textContent = '**bold**';
    const r = document.createRange();
    r.setStart(pre.firstChild, 8); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    editor.content.dispatchEvent(new InputEvent('input', { bubbles: true }));

    expect(pre.querySelector('strong')).toBeFalsy();
    expect(pre.textContent).toBe('**bold**');
  });

  it('SmartTypography paste rule linkifies bare URLs', () => {
    const out = runPasteRules('<p>see https://x.com ok</p>', SmartTypography.pasteRules);
    expect(out).toContain('<a href="https://x.com"');
    expect(out).toContain('>https://x.com</a>');
  });
});
