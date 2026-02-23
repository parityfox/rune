import { EventBus } from './EventBus.js';
import { History } from './History.js';
import { Schema } from './Schema.js';
import { Selection } from './Selection.js';
import { CommandRegistry, CommandChain } from './Commands.js';
import { normalizeHtml, sanitize } from '../utils/html.js';
import { el, getBlockElement } from '../utils/dom.js';
import { uid } from '../utils/id.js';

const MOD = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'Meta' : 'Control';

/**
 * Rune Editor
 *
 * Usage:
 *   const editor = new Editor('#my-div', {
 *     content: '<p>Hello world</p>',
 *     extensions: [Bold, Italic, Heading],
 *     toolbar: { items: ['bold', 'italic', '|', 'h1', 'h2'] },
 *     onChange(html) { console.log(html) }
 *   });
 */
export class Editor {
  constructor(target, options = {}) {
    if (typeof target === 'string') target = document.querySelector(target);
    if (!target) throw new Error('[Rune] Target element not found.');

    this.target = target;
    this.options = Object.assign({
      content: '',
      extensions: [],
      toolbar: true,
      bubbleMenu: true,
      slashMenu: true,
      placeholder: 'Write something…',
      onChange: null,
    }, options);

    this.events = new EventBus();
    this.schema = new Schema();
    this.commands = new CommandRegistry();
    this.history = new History(this);
    this.selection = new Selection(this);

    this._destroyed = false;
    this._slashQuery = '';

    this._mount();
    this._registerExtensions();
    this._bindEvents();
    this._initPlugins();
    this._initUI();
  }

  // ─── Extension Registration ──────────────────────────────────────────────

  _registerExtensions() {
    for (const ext of this.options.extensions) {
      this.schema.register(ext);
      if (ext.commands) this.commands.registerAll(ext.commands(this));
    }
    // Always register built-in commands
    this._registerBuiltinCommands();
  }

  _registerBuiltinCommands() {
    const self = this;

    this.commands.registerAll({
      // Inline marks via execCommand
      toggleBold:          () => self._execFormat('bold'),
      toggleItalic:        () => self._execFormat('italic'),
      toggleUnderline:     () => self._execFormat('underline'),
      toggleStrikethrough: () => self._execFormat('strikeThrough'),
      toggleSubscript:     () => self._execFormat('subscript'),
      toggleSuperscript:   () => self._execFormat('superscript'),

      // Remove all formatting in selection
      clearFormat: () => {
        self.history.saveNow();
        document.execCommand('removeFormat');
        document.execCommand('unlink');
        self._notifyChange();
      },

      // Links
      setLink(href, text) {
        self.history.saveNow();
        const sel = self.selection.native;
        if (sel && !sel.isCollapsed) {
          document.execCommand('createLink', false, href);
        } else {
          const a = el('a', { href, target: '_blank', rel: 'noopener' }, text || href);
          self._insertNode(a);
        }
        self._notifyChange();
      },
      unsetLink() {
        document.execCommand('unlink');
        self._notifyChange();
      },

      // Block type conversion
      setBlock(type, attrs = {}) {
        const block = self.schema.getBlock(type);
        if (!block) return false;
        self.history.saveNow();
        const currentBlock = self.selection.getBlock();
        if (!currentBlock) return false;

        const tag = Array.isArray(block.tag) ? block.tag[0] : block.tag;
        const newBlock = document.createElement(tag);
        newBlock.innerHTML = currentBlock.innerHTML || '<br>';
        Object.entries(attrs).forEach(([k, v]) => newBlock.setAttribute(k, v));
        newBlock.setAttribute('data-id', currentBlock.getAttribute('data-id') || uid());

        self.content.replaceChild(newBlock, currentBlock);
        self.selection.setAtEnd(newBlock);
        self._notifyChange();
      },

      // Insert a new block after current
      insertBlock(type, attrs = {}, html = '') {
        const block = self.schema.getBlock(type);
        if (!block) return false;
        self.history.saveNow();

        const tag = Array.isArray(block.tag) ? block.tag[0] : block.tag;
        const newBlock = document.createElement(tag);
        newBlock.innerHTML = html || '<br>';
        newBlock.setAttribute('data-id', uid());
        Object.entries(attrs).forEach(([k, v]) => newBlock.setAttribute(k, v));

        const currentBlock = self.selection.getBlock();
        if (currentBlock && currentBlock.nextSibling) {
          self.content.insertBefore(newBlock, currentBlock.nextSibling);
        } else {
          self.content.appendChild(newBlock);
        }
        self.selection.setAtStart(newBlock);
        self._notifyChange();
      },

      // Delete current block
      deleteBlock() {
        self.history.saveNow();
        const block = self.selection.getBlock();
        if (!block) return false;
        const prev = block.previousElementSibling;
        block.remove();
        if (self.content.children.length === 0) self._ensureContent();
        if (prev) self.selection.setAtEnd(prev);
        self._notifyChange();
      },

      // Indent / outdent list items
      indent() { document.execCommand('indent'); self._notifyChange(); },
      outdent() { document.execCommand('outdent'); self._notifyChange(); },

      // History
      undo() { self.history.undo(); },
      redo() { self.history.redo(); },

      // Focus
      focus() { self.focus(); },
    });
  }

  // ─── Mounting ────────────────────────────────────────────────────────────

  _mount() {
    this.wrapper = el('div', { class: 'rune-wrapper' });
    this.content = el('div', {
      class: 'rune-content',
      contenteditable: 'true',
      'data-rune-content': '',
      'aria-multiline': 'true',
      role: 'textbox',
    });

    this.content.setAttribute('data-placeholder', this.options.placeholder);
    this.wrapper.appendChild(this.content);
    this.target.appendChild(this.wrapper);
    this.target.classList.add('rune-editor');

    // Set initial content
    this.setHtml(this.options.content || '');
  }

  _initPlugins() {
    for (const plugin of this.schema.plugins) {
      if (typeof plugin.init === 'function') plugin.init(this);
    }
  }

  _initUI() {
    // Toolbar is imported dynamically to avoid circular deps
    if (this.options.toolbar) {
      import('../ui/Toolbar.js').then(({ Toolbar }) => {
        this.toolbar = new Toolbar(this);
        this.wrapper.prepend(this.toolbar.el);
      });
    }
    if (this.options.bubbleMenu) {
      import('../ui/BubbleMenu.js').then(({ BubbleMenu }) => {
        this.bubbleMenu = new BubbleMenu(this);
      });
    }
    if (this.options.slashMenu) {
      import('../ui/SlashMenu.js').then(({ SlashMenu }) => {
        this.slashMenu = new SlashMenu(this);
      });
    }
  }

  // ─── Event Binding ───────────────────────────────────────────────────────

  _bindEvents() {
    this._handlers = {
      input:           this._onInput.bind(this),
      keydown:         this._onKeydown.bind(this),
      paste:           this._onPaste.bind(this),
      selectionchange: this._onSelectionChange.bind(this),
      focus:           () => this.target.classList.add('rune-focused'),
      blur:            () => this.target.classList.remove('rune-focused'),
    };

    this.content.addEventListener('input',   this._handlers.input);
    this.content.addEventListener('keydown', this._handlers.keydown);
    this.content.addEventListener('paste',   this._handlers.paste);
    this.content.addEventListener('focus',   this._handlers.focus);
    this.content.addEventListener('blur',    this._handlers.blur);
    document.addEventListener('selectionchange', this._handlers.selectionchange);
  }

  _onInput() {
    this._ensureContent();
    this.history.save();
    this._notifyChange();
  }

  _onKeydown(e) {
    const key = this._keyString(e);

    // Check extension keymaps
    const keymap = this.schema.getKeymap();
    if (keymap[key]) {
      e.preventDefault();
      keymap[key](this);
      return;
    }

    // Built-in shortcuts
    if (key === `${MOD === 'Meta' ? 'Meta' : 'Control'}+z`) {
      e.preventDefault();
      this.chain().undo().run();
      return;
    }
    if (key === `${MOD === 'Meta' ? 'Meta' : 'Control'}+shift+z` ||
        key === `${MOD === 'Meta' ? 'Meta' : 'Control'}+y`) {
      e.preventDefault();
      this.chain().redo().run();
      return;
    }

    // Slash menu trigger
    if (e.key === '/' && this.selection.isCollapsed) {
      this._slashQuery = '';
      this.events.emit('slash:open', { editor: this });
    }
    if (this.options.slashMenu && this._slashActive) {
      if (e.key === 'Escape') {
        this.events.emit('slash:close');
      } else if (e.key === 'Backspace' && this._slashQuery === '') {
        this.events.emit('slash:close');
      }
    }

    // Enter in empty block — convert back to paragraph
    if (e.key === 'Enter' && !e.shiftKey) {
      const block = this.selection.getBlock();
      if (block && /^H[1-6]$/.test(block.tagName)) {
        const isEmpty = block.textContent.trim() === '';
        if (isEmpty) {
          e.preventDefault();
          this.chain().setBlock('paragraph').run();
          return;
        }
      }
    }

    // Backspace in empty block — remove it
    if (e.key === 'Backspace') {
      const block = this.selection.getBlock();
      if (block && block.textContent.trim() === '' &&
          this.content.children.length > 1) {
        e.preventDefault();
        this.chain().deleteBlock().run();
        return;
      }
    }

    this.events.emit('keydown', { editor: this, event: e });
  }

  _onPaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/html') ||
                 e.clipboardData.getData('text/plain');
    const clean = sanitize(text);
    document.execCommand('insertHTML', false, clean);
    this._notifyChange();
    this.events.emit('paste', { editor: this });
  }

  _onSelectionChange() {
    if (this._destroyed) return;
    this.events.emit('selectionchange', { editor: this });
  }

  // ─── Core Utilities ──────────────────────────────────────────────────────

  _keyString(e) {
    const parts = [];
    if (e.metaKey) parts.push('Meta');
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('shift');
    if (e.key && e.key !== 'Meta' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift') {
      parts.push(e.key);
    }
    return parts.join('+');
  }

  _execFormat(command) {
    this.content.focus();
    document.execCommand(command);
    this._notifyChange();
  }

  _insertNode(node) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  _ensureContent() {
    if (this.content.children.length === 0 ||
        (this.content.children.length === 1 &&
         this.content.firstElementChild.tagName === 'BR')) {
      this.content.innerHTML = '<p><br></p>';
    }
  }

  _notifyChange() {
    const html = this.getHtml();
    this.events.emit('change', { editor: this, html });
    if (typeof this.options.onChange === 'function') {
      this.options.onChange(html, this);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /** Execute a command by name. */
  cmd(name, ...args) {
    const fn = this.commands.get(name);
    if (!fn) { console.warn(`[Rune] Unknown command: "${name}"`); return false; }
    return fn(...args);
  }

  /** Start a command chain: editor.chain().toggleBold().run() */
  chain() {
    return CommandChain.create(this);
  }

  /** Execute an internal format command (used by extensions). */
  _exec(name, ...args) {
    return this.cmd(name, ...args);
  }

  /** Check if a mark/format is currently active at the caret. */
  isActive(type, attrs = {}) {
    // Check block type
    const block = this.selection.getBlock();
    if (!block) return false;
    const blockExt = this.schema.resolveBlock(block);
    if (blockExt && blockExt.name === type) return true;

    // Check inline mark via queryCommandState
    const mark = this.schema.getMark(type);
    if (mark && mark.execCommand) {
      try { return document.queryCommandState(mark.execCommand); } catch { return false; }
    }

    return false;
  }

  /** Get editor HTML content. */
  getHtml() {
    // Clone and clean internal attributes
    const clone = this.content.cloneNode(true);
    return clone.innerHTML;
  }

  /** Set editor HTML content. */
  setHtml(html) {
    this.content.innerHTML = normalizeHtml(html);
    this._ensureContent();
    this.history.saveNow();
    this.events.emit('change', { editor: this, html: this.getHtml() });
  }

  /** Get plain text. */
  getText() {
    return this.content.innerText;
  }

  /** Check if editor is empty. */
  isEmpty() {
    return this.content.innerText.trim() === '';
  }

  /** Focus the editor. */
  focus() {
    this.content.focus();
    return this;
  }

  /** Blur the editor. */
  blur() {
    this.content.blur();
    return this;
  }

  /** Enable editing. */
  enable() {
    this.content.contentEditable = 'true';
    this.target.classList.remove('rune-disabled');
    return this;
  }

  /** Disable editing. */
  disable() {
    this.content.contentEditable = 'false';
    this.target.classList.add('rune-disabled');
    return this;
  }

  /** Destroy the editor and clean up. */
  destroy() {
    this._destroyed = true;
    this.content.removeEventListener('input',   this._handlers.input);
    this.content.removeEventListener('keydown', this._handlers.keydown);
    this.content.removeEventListener('paste',   this._handlers.paste);
    this.content.removeEventListener('focus',   this._handlers.focus);
    this.content.removeEventListener('blur',    this._handlers.blur);
    document.removeEventListener('selectionchange', this._handlers.selectionchange);

    this.toolbar?.destroy?.();
    this.bubbleMenu?.destroy?.();
    this.slashMenu?.destroy?.();

    this.wrapper.remove();
    this.target.classList.remove('rune-editor', 'rune-focused', 'rune-disabled');
    this.events.removeAllListeners();
    this.history._stack = [];
  }
}
