import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';
import { Heading } from '../src/extensions/blocks/Heading.js';
import { Bold } from '../src/extensions/marks/Bold.js';
import { Italic } from '../src/extensions/marks/Italic.js';
import { Blockquote } from '../src/extensions/blocks/Blockquote.js';
import { CodeBlock } from '../src/extensions/blocks/CodeBlock.js';
import { BulletList } from '../src/extensions/blocks/BulletList.js';
import { Image } from '../src/extensions/blocks/Image.js';
import { VideoEmbed } from '../src/extensions/blocks/VideoEmbed.js';

describe('Editor', () => {
  let target;
  let editor;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
  });

  afterEach(() => {
    editor?.destroy();
    target.remove();
  });

  function create(opts = {}) {
    editor = new Editor(target, {
      extensions: [Paragraph, Heading, Bold, Italic, Blockquote, CodeBlock],
      toolbar: false,
      bubbleMenu: false,
      slashMenu: false,
      ...opts,
    });
    return editor;
  }

  describe('mounting', () => {
    it('creates wrapper and content elements', () => {
      create();
      expect(target.querySelector('.rune-wrapper')).toBeTruthy();
      expect(target.querySelector('.rune-content')).toBeTruthy();
    });

    it('adds rune-editor class to target', () => {
      create();
      expect(target.classList.contains('rune-editor')).toBe(true);
    });

    it('throws on invalid target', () => {
      expect(() => new Editor('#nonexistent')).toThrow('Target element not found');
    });

    it('sets initial content', () => {
      create({ content: '<p>Hello</p>' });
      expect(editor.getHtml()).toContain('Hello');
    });

    it('sets placeholder', () => {
      create({ placeholder: 'Type here...' });
      expect(editor.content.dataset.placeholder).toBe('Type here...');
    });
  });

  describe('getHtml / setHtml', () => {
    it('round-trips HTML', () => {
      create({ content: '<p>test content</p>' });
      expect(editor.getHtml()).toContain('test content');
    });

    it('setHtml updates content', () => {
      create();
      editor.setHtml('<p>new content</p>');
      expect(editor.getHtml()).toContain('new content');
    });

    it('normalizes bare text into paragraphs', () => {
      create({ content: 'bare text' });
      expect(editor.getHtml()).toContain('<p>');
    });
  });

  describe('getText', () => {
    it('returns plain text', () => {
      create({ content: '<p>Hello <strong>world</strong></p>' });
      expect(editor.getText().trim()).toBe('Hello world');
    });
  });

  describe('isEmpty', () => {
    it('returns true for empty editor', () => {
      create({ content: '' });
      expect(editor.isEmpty()).toBe(true);
    });

    it('returns false when editor has content', () => {
      create({ content: '<p>text</p>' });
      expect(editor.isEmpty()).toBe(false);
    });
  });

  describe('enable / disable', () => {
    it('disable sets contenteditable to false', () => {
      create();
      editor.disable();
      expect(editor.content.contentEditable).toBe('false');
      expect(target.classList.contains('rune-disabled')).toBe(true);
    });

    it('enable restores contenteditable', () => {
      create();
      editor.disable();
      editor.enable();
      expect(editor.content.contentEditable).toBe('true');
      expect(target.classList.contains('rune-disabled')).toBe(false);
    });

    it('methods are chainable', () => {
      create();
      expect(editor.enable()).toBe(editor);
      expect(editor.disable()).toBe(editor);
    });
  });

  describe('commands', () => {
    it('cmd executes registered commands', () => {
      create();
      // setHeading is registered by the Heading extension
      expect(editor.commands.has('setHeading')).toBe(true);
    });

    it('cmd warns on unknown command', () => {
      create();
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      editor.cmd('nonexistent');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
      spy.mockRestore();
    });

    it('auto-registers toggle commands from marks with execCommand', () => {
      create();
      expect(editor.commands.has('toggleBold')).toBe(true);
      expect(editor.commands.has('toggleItalic')).toBe(true);
    });
  });

  describe('extension registration', () => {
    it('registers blocks in schema', () => {
      create();
      expect(editor.schema.getBlock('paragraph')).toBeTruthy();
      expect(editor.schema.getBlock('heading')).toBeTruthy();
    });

    it('registers marks in schema', () => {
      create();
      expect(editor.schema.getMark('bold')).toBeTruthy();
      expect(editor.schema.getMark('italic')).toBeTruthy();
    });
  });

  describe('events', () => {
    it('onChange callback fires on _notifyChange', () => {
      const onChange = vi.fn();
      create({ onChange, content: '<p>initial</p>' });
      editor._notifyChange();
      expect(onChange).toHaveBeenCalled();
    });

    it('emits change event', () => {
      const fn = vi.fn();
      create();
      editor.events.on('change', fn);
      editor.setHtml('<p>new</p>');
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('emits destroy event', () => {
      create();
      const fn = vi.fn();
      editor.events.on('destroy', fn);
      editor.destroy();
      expect(fn).toHaveBeenCalledOnce();
      editor = null; // prevent double destroy in afterEach
    });

    it('removes DOM elements', () => {
      create();
      editor.destroy();
      expect(target.querySelector('.rune-wrapper')).toBeNull();
      expect(target.classList.contains('rune-editor')).toBe(false);
      editor = null;
    });
  });

  describe('security', () => {
    it('setLink rejects javascript: URIs', () => {
      create({ content: '<p>text</p>' });
      editor.cmd('setLink', 'javascript:alert(1)', 'evil');
      expect(editor.getHtml()).not.toContain('javascript:');
    });

    it('insertImage rejects dangerous URLs', () => {
      const e = create({
        extensions: [Paragraph, Image],
        content: '<p>text</p>',
      });
      e.cmd('insertImage', 'javascript:alert(1)');
      expect(e.getHtml()).not.toContain('javascript:');
    });
  });

  describe('clearFormat', () => {
    // Select `count` chars starting at `start` within the first text node
    // found under `host` (depth-first), then run clearFormat.
    function selectAndClear(start, count, host = editor.content) {
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode();
      const range = document.createRange();
      range.setStart(text, start);
      range.setEnd(text, start + count);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      editor.cmd('clearFormat');
    }

    it('removes formatting when the whole inline element is selected', () => {
      create({ content: '<p><strong>word</strong></p>' });
      selectAndClear(0, 4);
      expect(editor.getHtml()).toBe('<p>word</p>');
    });

    it('removes formatting from a partial (trailing) selection', () => {
      create({ content: '<p><strong>word</strong></p>' });
      selectAndClear(2, 2);                       // "rd"
      expect(editor.getHtml()).toBe('<p><strong>wo</strong>rd</p>');  // only "wo" stays bold
    });

    it('strips nested inline formatting', () => {
      create({ content: '<p><strong><em>word</em></strong></p>' });
      selectAndClear(0, 4);
      expect(editor.getHtml()).toBe('<p>word</p>');
    });

    it('clears bold in the middle of a sentence', () => {
      create({ content: '<p>aa <strong>bb</strong> cc</p>' });
      const host = editor.content;
      // select the "bb" inside <strong>
      const strong = host.querySelector('strong');
      const range = document.createRange();
      range.selectNodeContents(strong);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      editor.cmd('clearFormat');
      expect(editor.getHtml()).toBe('<p>aa bb cc</p>');
    });

    it('does nothing on a collapsed selection', () => {
      create({ content: '<p><strong>word</strong></p>' });
      const text = editor.content.querySelector('strong').firstChild;
      const range = document.createRange();
      range.setStart(text, 2);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      editor.cmd('clearFormat');
      expect(editor.getHtml()).toBe('<p><strong>word</strong></p>');
    });

    function selectAll() {
      const range = document.createRange();
      range.selectNodeContents(editor.content);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    it('resets headings to paragraphs', () => {
      create({ content: '<h2>Title</h2><p>body</p>' });
      selectAll();
      editor.cmd('clearFormat');
      expect(editor.getHtml()).toBe('<p>Title</p><p>body</p>');
    });

    it('resets blockquote to paragraph', () => {
      create({ content: '<blockquote>quote</blockquote>' });
      selectAll();
      editor.cmd('clearFormat');
      expect(editor.getHtml()).toBe('<p>quote</p>');
    });

    it('clears heading + inline but keeps lists intact', () => {
      create({
        extensions: [Paragraph, Heading, Bold, BulletList],
        content: '<h2>T</h2><ul><li>Use the <strong>x</strong></li></ul>',
      });
      selectAll();
      editor.cmd('clearFormat');
      const html = editor.getHtml();
      expect(html).toContain('<p>T</p>');       // heading reset
      expect(html).toContain('<ul>');           // list kept
      expect(html).toContain('<li>Use the x</li>');
      expect(html).not.toContain('<strong>');   // inline gone
    });

    it('resets a heading when the selection bleeds into the next block', () => {
      // Triple-clicking a heading selects to the start of the following block.
      // That boundary bleed must not fragment the next block (regression).
      create({
        extensions: [Paragraph, Heading, Bold, BulletList],
        content: '<h3>Title</h3><ul><li>Use the <strong>x</strong></li></ul>',
      });
      const h3 = editor.content.querySelector('h3');
      const li = editor.content.querySelector('li');
      const range = document.createRange();
      range.setStart(h3.firstChild, 0);
      range.setEnd(li.firstChild, 0);            // bleed into the list
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      editor.cmd('clearFormat');
      const html = editor.getHtml();
      expect(html).toContain('<p>Title</p>');                  // heading reset
      expect(html).not.toContain('<h3>');
      expect(html).toContain('<li>Use the <strong>x</strong></li>'); // list untouched
      expect(html).not.toContain('<li></li>');                 // no stray empty bullet
    });
  });
});
