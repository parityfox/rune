import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';
import { Heading } from '../src/extensions/blocks/Heading.js';
import { Bold } from '../src/extensions/marks/Bold.js';
import { Italic } from '../src/extensions/marks/Italic.js';
import { Blockquote } from '../src/extensions/blocks/Blockquote.js';
import { CodeBlock } from '../src/extensions/blocks/CodeBlock.js';
import { BulletList } from '../src/extensions/blocks/BulletList.js';
import { sanitize, sanitizeContent } from '../src/utils/html.js';
import { Image } from '../src/extensions/blocks/Image.js';
import { VideoEmbed } from '../src/extensions/blocks/VideoEmbed.js';
import { FormatPainter } from '../src/extensions/plugins/FormatPainter.js';

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

    it('exposes an accessible name and aria-placeholder on the editable region (#57)', () => {
      create({ placeholder: 'Type here', ariaLabel: 'My editor' });
      const content = target.querySelector('.rune-content');
      expect(content.getAttribute('role')).toBe('textbox');
      expect(content.getAttribute('aria-label')).toBe('My editor');
      expect(content.getAttribute('aria-placeholder')).toBe('Type here');
    });

    it('renders an opt-out attribution badge by default', () => {
      create();
      const badge = target.querySelector('.rune-attribution');
      expect(badge).toBeTruthy();
      expect(badge.getAttribute('href')).toBe('https://parityfox.com');
      expect(badge.textContent).toBe('Made with Rune');
    });

    it('omits the attribution badge when attribution is false', () => {
      create({ attribution: false });
      expect(target.querySelector('.rune-attribution')).toBeNull();
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

    it('disposes the history on destroy', () => {
      create();
      const spy = vi.spyOn(editor.history, 'destroy');
      editor.destroy();
      expect(spy).toHaveBeenCalled();
      editor = null;
    });
  });

  describe('pluggable history (EditorHistory seam)', () => {
    it('accepts an injected history instance via options', () => {
      const custom = { save: vi.fn(), saveNow: vi.fn(), undo: vi.fn(), redo: vi.fn(), destroy: vi.fn() };
      editor = new Editor(target, { extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false, history: custom });
      expect(editor.history).toBe(custom);
    });

    it('accepts a history factory via options', () => {
      const custom = { save: vi.fn(), saveNow: vi.fn(), undo: vi.fn(), redo: vi.fn() };
      const factory = vi.fn(() => custom);
      editor = new Editor(target, { extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false, history: factory });
      expect(factory).toHaveBeenCalledWith(editor);
      expect(editor.history).toBe(custom);
    });

    it('routes undo/redo commands through the active history', () => {
      const custom = { save: vi.fn(), saveNow: vi.fn(), undo: vi.fn(), redo: vi.fn() };
      create();
      editor.replaceHistory(custom);
      editor.cmd('undo');
      editor.cmd('redo');
      expect(custom.undo).toHaveBeenCalled();
      expect(custom.redo).toHaveBeenCalled();
    });

    it('replaceHistory disposes the previous history', () => {
      create();
      const old = editor.history;
      const spy = vi.spyOn(old, 'destroy');
      editor.replaceHistory({ save() {}, saveNow() {}, undo() {}, redo() {} });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('undo/redo (command-flow regression)', () => {
    // Commands snapshot their PRE-mutation state then mutate the DOM, and the
    // mutation (being programmatic) fires no input event — so the result is
    // never pushed. undo() must flush the live state before stepping back.
    it('undoes a command-style change snapshotted only before the mutation', () => {
      create({ content: '<p>hello</p>' });
      editor.history.saveNow();                       // boundary (de-dupes)
      editor.content.innerHTML = '<h1>hello</h1>';    // mutate, no input event
      expect(editor.history.undo()).toBe(true);
      expect(editor.content.innerHTML).toContain('<p>hello</p>');
    });

    it('makes the FIRST command on a fresh document undoable', () => {
      create({ content: '<p>only</p>' });
      // No prior edits: the pre-mutation snapshot equals the initial one and is
      // de-duped, so the result is the only unsaved state.
      editor.history.saveNow();
      editor.content.innerHTML = '<blockquote>only</blockquote>';
      expect(editor.history.undo()).toBe(true);
      expect(editor.content.innerHTML).toContain('<p>only</p>');
    });

    it('redo restores the command result after undo', () => {
      create({ content: '<p>hello</p>' });
      editor.history.saveNow();
      editor.content.innerHTML = '<h1>hello</h1>';
      editor.history.undo();
      expect(editor.history.redo()).toBe(true);
      expect(editor.content.innerHTML).toContain('<h1>hello</h1>');
    });

    it('undoes a real setBlock command back to a paragraph', () => {
      create({ content: '<p>hello</p>' });
      const p = editor.content.querySelector('p');
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      editor.cmd('setBlock', 'heading');
      expect(editor.content.querySelector('h1')).toBeTruthy();

      editor.history.undo();
      expect(editor.content.querySelector('h1')).toBeFalsy();
      expect(editor.content.querySelector('p')).toBeTruthy();
    });

    it('fires onChange on undo and redo (#26)', () => {
      const onChange = vi.fn();
      create({ content: '<p>hello</p>', onChange });
      editor.history.saveNow();
      editor.content.innerHTML = '<h1>hello</h1>';

      onChange.mockClear();
      editor.history.undo();
      expect(onChange).toHaveBeenCalled();

      onChange.mockClear();
      editor.history.redo();
      expect(onChange).toHaveBeenCalled();
    });

    it('fires onChange on setHtml (#26)', () => {
      const onChange = vi.fn();
      create({ content: '<p>hello</p>', onChange });
      onChange.mockClear();
      editor.setHtml('<p>replaced</p>');
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('FormatPainter lifecycle (#53)', () => {
    it('unbinds the armed mouseup listener and class when the editor is destroyed', () => {
      document.queryCommandState = () => false;
      editor = new Editor(target, {
        extensions: [Paragraph, FormatPainter],
        toolbar: false, bubbleMenu: false, slashMenu: false,
        content: '<p>hi</p>',
      });
      const p = editor.content.querySelector('p');
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      editor.cmd('activateFormatPainter');
      expect(editor.content.classList.contains('rune-painter-active')).toBe(true);

      const removeSpy = vi.spyOn(editor.content, 'removeEventListener');
      editor.destroy();
      expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(editor.content.classList.contains('rune-painter-active')).toBe(false);
      editor = null; // already destroyed
    });
  });

  describe('async UI init teardown (#49)', () => {
    it('does not mount toolbar/menus after destroy() runs before the dynamic import resolves', async () => {
      editor = new Editor(target, {
        extensions: [Paragraph],
        toolbar: true, bubbleMenu: true, slashMenu: true,
      });
      editor.destroy();
      // Let the pending dynamic imports settle.
      await new Promise((r) => setTimeout(r, 20));
      expect(editor.toolbar).toBeUndefined();
      expect(editor.bubbleMenu).toBeUndefined();
      expect(editor.slashMenu).toBeUndefined();
      editor = null; // already destroyed; skip afterEach double-destroy
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

    it('setLink rejects data:image/svg+xml (SVG script vector)', () => {
      create({ content: '<p>text</p>' });
      editor.cmd('setLink', 'data:image/svg+xml,<svg onload=alert(1)>', 'x');
      expect(editor.getHtml()).not.toContain('data:image/svg');
      expect(editor.getHtml()).not.toContain('<svg');
    });

    it('setHtml strips event handlers and dangerous tags', () => {
      create();
      editor.setHtml('<p>ok</p><img src=x onerror="alert(1)"><script>alert(2)</script>');
      const html = editor.getHtml();
      expect(html).not.toContain('onerror');
      expect(html).not.toContain('<script');
      expect(html).toContain('ok');
    });

    it('setHtml strips an iframe with a non-embed / javascript src', () => {
      create();
      editor.setHtml('<iframe src="javascript:alert(1)"></iframe><iframe src="https://evil.example.com"></iframe>');
      const html = editor.getHtml();
      expect(html).not.toContain('<iframe');
      expect(html).not.toContain('javascript:');
    });

    it('sanitizeContent() keeps a sandboxed YouTube embed', () => {
      // Tested at the sanitizer level to avoid happy-dom fetching a live iframe.
      const out = sanitizeContent('<figure class="rune-video-block"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></figure>');
      expect(out).toContain('youtube.com/embed/dQw4w9WgXcQ');
      expect(out).toMatch(/sandbox="allow-scripts allow-same-origin"/);
    });

    it('sanitizeContent() drops a non-embed iframe', () => {
      expect(sanitizeContent('<iframe src="https://evil.example.com"></iframe>')).not.toContain('<iframe');
      expect(sanitizeContent('<iframe src="javascript:alert(1)"></iframe>')).not.toContain('<iframe');
    });

    it('setHtml preserves contenteditable on editor blocks', () => {
      create();
      editor.setHtml('<div class="rune-callout"><span contenteditable="false">x</span><div class="rune-callout-body">body</div></div>');
      expect(editor.getHtml()).toContain('contenteditable="false"');
    });

    it('sanitize() adds rel=noopener to target=_blank links', () => {
      const out = sanitize('<a href="https://x.com" target="_blank">x</a>');
      expect(out).toContain('rel="noopener noreferrer"');
    });

    it('sanitize() (paste profile) removes all iframes', () => {
      const out = sanitize('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>');
      expect(out).not.toContain('<iframe');
    });

    it('sanitizeContent() strips javascript: hrefs but keeps safe links', () => {
      expect(sanitizeContent('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
      expect(sanitizeContent('<a href="https://ok.com">x</a>')).toContain('https://ok.com');
    });

    it('sanitize() removes <template> (content lives outside childNodes)', () => {
      // template.content is a DocumentFragment the recursive cleaner cannot reach,
      // so the whole element must be dropped, not just its (unreachable) children.
      expect(sanitize('<template><img src=x onerror=alert(1)></template>')).toBe('');
      expect(sanitizeContent('<p>ok</p><template><img onerror=alert(1)></template>')).toBe('<p>ok</p>');
    });

    it('sanitize() strips url() from inline styles (tracking / escape bypass)', () => {
      expect(sanitize('<p style="background:url(https://evil.com/x.png)">x</p>')).not.toContain('url(');
      expect(sanitize('<p style="background:url(\\64 ata:image/png;base64,AAA)">x</p>')).not.toContain('url(');
      // benign styling survives
      expect(sanitize('<p style="color:red">x</p>')).toContain('color');
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
