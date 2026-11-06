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

describe('typing after inline markdown (#192)', () => {
  let target, editor;
  afterEach(() => { editor?.destroy(); target?.remove(); editor = target = null; });
  const clean = (h) => h.replace(/ data-id="[^"]*"/g, '');

  // Types the markers into a paragraph; the rule leaves the caret after the new mark.
  function convert(text, opts = {}) {
    target = document.createElement('div'); document.body.appendChild(target);
    editor = new Editor(target, { extensions: [Paragraph, InlineMarkdown], toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p></p>', ...opts });
    const p = editor.content.querySelector('p');
    p.textContent = text;
    const r = document.createRange(); r.setStart(p.firstChild, text.length); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    editor.content.dispatchEvent(new Event('input', { bubbles: true }));
    return p;
  }
  function typeChar(data, inputType = 'insertText') {
    const e = new Event('beforeinput', { bubbles: true, cancelable: true });
    Object.assign(e, { inputType, data });
    editor.content.dispatchEvent(e);
    return e;
  }

  for (const [markers, tag] of [['**x**', 'strong'], ['*x*', 'em'], ['_x_', 'em'], ['~~x~~', 's'], ['`x`', 'code']]) {
    it(`the next character after ${markers} lands outside <${tag}>`, () => {
      const p = convert(markers);
      expect(typeChar('a').defaultPrevented).toBe(true);
      expect(clean(p.innerHTML)).toBe(`<${tag}>x</${tag}>a`);
    });
  }

  it('leaves the caret after the character', () => {
    const p = convert('**x**');
    typeChar('a');
    const sel = window.getSelection();
    expect(sel.anchorNode).toBe(p.lastChild);
    expect(sel.anchorOffset).toBe(1);
  });

  it('joins text that already follows the mark', () => {
    const p = convert('**x**');
    p.appendChild(document.createTextNode('tail'));
    typeChar('a');
    expect(clean(p.innerHTML)).toBe('<strong>x</strong>atail');
  });

  it('keeps a space visible at the end of a block', () => {
    const p = convert('**x**');
    typeChar(' ');
    expect(p.lastChild.data).toBe('\u00A0');
  });

  it('turns that space back into a normal one once text follows', () => {
    const seen = [];
    const p = convert('**x**', { onChange: (h) => seen.push(h) });
    typeChar(' ');
    p.lastChild.appendData('a');            // the browser types the next character
    editor.content.dispatchEvent(new Event('input', { bubbles: true }));
    expect(p.lastChild.data).toBe(' a');
    expect(seen.at(-1)).not.toContain('nbsp');
  });

  it('leaves the space alone if it is deleted instead', () => {
    const p = convert('**x**');
    typeChar(' ');
    p.lastChild.remove();
    expect(() => editor.content.dispatchEvent(new Event('input', { bubbles: true }))).not.toThrow();
  });

  it('keeps a plain space when text follows', () => {
    const p = convert('**x**');
    p.appendChild(document.createTextNode('tail'));
    typeChar(' ');
    expect(p.lastChild.data).toBe(' tail');
  });

  it('only steps in once', () => {
    convert('**x**');
    typeChar('a');
    expect(typeChar('b').defaultPrevented).toBe(false);
  });

  it('notifies a change and adds nothing invisible', () => {
    const seen = [];
    const p = convert('**x**', { onChange: (h) => seen.push(h) });
    seen.length = 0;
    typeChar('a');
    expect(seen.length).toBe(1);
    expect(seen[0]).toContain('</strong>a');
    expect(p.textContent).toBe('xa');
    expect(editor.getHtml()).not.toMatch(/\u200b/);
  });

  it('one undo after typing still gets back to the converted text', () => {
    const p = convert('**x**');
    typeChar('a');
    editor.history.undo();
    expect(editor.content.querySelector('p').textContent).not.toContain('a');
    expect(p).toBeTruthy();
  });

  it('leaves other input to the browser', () => {
    convert('**x**');
    expect(typeChar(null, 'deleteContentBackward').defaultPrevented).toBe(false);
    expect(typeChar('a').defaultPrevented).toBe(false);   // the chance has passed
  });

  it('leaves Enter to the browser', () => {
    convert('**x**');
    expect(typeChar(null, 'insertParagraph').defaultPrevented).toBe(false);
  });

  it('does nothing once the caret has moved away', () => {
    const p = convert('**x** ');
    const other = document.createElement('p');
    other.textContent = 'other';
    p.after(other);
    const r = document.createRange(); r.setStart(other.firstChild, 2); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    expect(typeChar('a').defaultPrevented).toBe(false);
  });

  it('does nothing with a selection', () => {
    const p = convert('**x**');
    const r = document.createRange(); r.selectNodeContents(p);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    expect(typeChar('a').defaultPrevented).toBe(false);
  });

  it('does nothing when something else already handled the key', () => {
    const p = convert('**x**');
    editor.content.addEventListener('beforeinput', (e) => e.preventDefault(), { capture: true, once: true });
    typeChar('a');
    expect(clean(p.innerHTML)).toBe('<strong>x</strong>');
  });

  it('stops listening on destroy', () => {
    convert('**x**');
    const content = editor.content;
    editor.destroy();
    const e = new Event('beforeinput', { bubbles: true, cancelable: true });
    Object.assign(e, { inputType: 'insertText', data: 'a' });
    content.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    editor = null;
  });
});

