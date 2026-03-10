import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';
import { Heading } from '../src/extensions/blocks/Heading.js';
import { Bold } from '../src/extensions/marks/Bold.js';
import { Italic } from '../src/extensions/marks/Italic.js';
import { Blockquote } from '../src/extensions/blocks/Blockquote.js';
import { CodeBlock } from '../src/extensions/blocks/CodeBlock.js';
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
});
