import { EventBus } from './EventBus.js';
import { History } from './History.js';
import { Schema } from './Schema.js';
import { Selection } from './Selection.js';
import { CommandRegistry, CommandChain } from './Commands.js';
import { normalizeHtml, sanitize, sanitizeContent, _isDangerousUrl } from '../utils/html.js';
import { runInputRules, runPasteRules } from './InputRules.js';
import { Decorations } from './Decorations.js';
import { htmlToMarkdown } from '../utils/markdown.js';
import { markdownToHtml } from '../utils/markdownToHtml.js';
import { el, getBlockElement } from '../utils/dom.js';
import { uid } from '../utils/id.js';

// Resolve the platform modifier key lazily. Reading `navigator` at module load
// crashes SSR/Node (Next.js, Nuxt) the instant the package is imported, so we
// defer the probe to first use (keydown only ever runs in a browser) and memoize.
let _modKey = null;
function getModKey() {
  if (_modKey) return _modKey;
  if (typeof navigator === 'undefined') return (_modKey = 'Control');
  const isMac = navigator.userAgentData
    ? navigator.userAgentData.platform === 'macOS'
    : /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  return (_modKey = isMac ? 'Meta' : 'Control');
}

// Heuristic: does this plain-text clipboard payload read as Markdown? (Used to
// decide whether to convert on paste; plain prose returns false.)
function _looksLikeMarkdown(t) {
  return /(^|\n)\s{0,3}#{1,6}\s/.test(t) ||
         /(^|\n)\s{0,3}([-*+]|\d+[.)])\s+/.test(t) ||
         /(^|\n)\s{0,3}>\s/.test(t) ||
         /(^|\n)```/.test(t) ||
         /\*\*[^*\n]+\*\*/.test(t) ||
         /\[[^\]\n]+\]\([^)\n]+\)/.test(t) ||
         /(^|\n)\s*\|.+\|/.test(t);
}

// Nearest ancestor element with the given tag, bounded by the content root.
function _closestTag(node, tag, content) {
  let n = node?.nodeType === 1 ? node : node?.parentNode;
  while (n && n !== content) {
    if (n.tagName?.toLowerCase() === tag) return n;
    n = n.parentNode;
  }
  return null;
}
function _applyAttrs(elm, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') elm.className = v;
    else elm.setAttribute(k, v);
  }
}

// Concise messages announced to assistive tech when these commands run (#63).
const _CMD_LABELS = {
  toggleBold: 'Bold', toggleItalic: 'Italic', toggleUnderline: 'Underline',
  toggleStrike: 'Strikethrough', toggleCode: 'Code',
  insertTable: 'Table inserted', insertCallout: 'Callout inserted',
  insertTaskList: 'Task list inserted', insertImage: 'Image inserted',
  setLink: 'Link added', clearFormat: 'Formatting cleared',
};

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
      ariaLabel: 'Rich text editor',   // accessible name for the editable region
      pasteMarkdown: true,             // convert Markdown-looking pasted text
      onChange: null,
      attribution: true,        // small "Made with Rune" credit; set false to remove
    }, options);

    this.events = new EventBus();
    this.schema = new Schema();
    this.commands = new CommandRegistry();
    // History is pluggable behind the EditorHistory contract. `options.history`
    // may be a factory `(editor) => EditorHistory` or a ready instance; the
    // collab binding swaps in a Yjs-backed adapter via replaceHistory().
    this.history = typeof options.history === 'function'
      ? options.history(this)
      : (options.history && typeof options.history.undo === 'function')
        ? options.history
        : new History(this);
    this.selection = new Selection(this);

    this._destroyed = false;
    this._ready = false;          // suppress onChange until construction finishes
    this._selRaf = null;          // rAF handle coalescing selectionchange emits
    this._slashQuery = '';

    this._mount();
    this._registerExtensions();
    this._bindEvents();
    this._initPlugins();
    this._initUI();

    // Non-destructive overlay for highlights/comments/cursors (keeps getHtml clean).
    this.decorations = new Decorations(this);

    // Setting the initial content (in _mount) is not a user-facing "change", and
    // onChange handlers commonly reference the editor instance — which the caller
    // hasn't received yet mid-constructor. Only fire onChange after this point.
    this._ready = true;
  }

  // ─── Extension Registration ──────────────────────────────────────────────

  _registerExtensions() {
    for (const ext of this.options.extensions) {
      this.schema.register(ext);

      // Auto-register toggle command for marks that declare execCommand.
      // Uses ext.toggleCommand if specified, otherwise derives from ext.name.
      if (ext.type === 'mark' && ext.execCommand) {
        const cmd = ext.execCommand;
        const name = ext.toggleCommand || ('toggle' + ext.name.charAt(0).toUpperCase() + ext.name.slice(1));
        this.commands.register(name, () => this._execFormat(cmd));
      }

      if (ext.commands) this.commands.registerAll(ext.commands(this));
    }
    // Always register built-in commands
    this._registerBuiltinCommands();
  }

  _registerBuiltinCommands() {
    const self = this;

    this.commands.registerAll({
      // Clear formatting from the selection. Strips inline formatting (bold,
      // italic, links, colour, code…) and resets heading/quote/callout blocks
      // to plain paragraphs; lists are left intact. Implemented via DOM
      // manipulation, never document.execCommand (which no-ops unpredictably).
      clearFormat: () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        if (!self.content.contains(range.commonAncestorContainer)) return;

        const INLINE = new Set([
          'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'INS',
          'SUB', 'SUP', 'CODE', 'MARK', 'FONT', 'SMALL', 'BIG', 'TT', 'SPAN', 'A',
        ]);
        const isInline  = (n) => n && n.nodeType === 1 && INLINE.has(n.tagName);
        const isHeading = (b) => /^H[1-6]$/.test(b.tagName);
        const isQuote   = (b) => b.tagName === 'BLOCKQUOTE';
        const isCallout = (b) => b.getAttribute?.('data-type') === 'callout' ||
                                 b.classList?.contains('rune-callout');

        // Recursively unwrap inline tags in a subtree; clear inline style on the rest.
        const strip = (parent) => {
          for (const child of [...parent.childNodes]) {
            if (child.nodeType !== 1) continue;
            strip(child);
            if (INLINE.has(child.tagName)) {
              while (child.firstChild) parent.insertBefore(child.firstChild, child);
              parent.removeChild(child);
            } else {
              child.removeAttribute('style');
            }
          }
        };

        // Portion of the selection that actually lies within block `b`.
        const clampToBlock = (b) => {
          const r  = range.cloneRange();
          const br = document.createRange();
          br.selectNodeContents(b);
          if (r.compareBoundaryPoints(Range.START_TO_START, br) < 0) r.setStart(br.startContainer, br.startOffset);
          if (r.compareBoundaryPoints(Range.END_TO_END,   br) > 0) r.setEnd(br.endContainer, br.endOffset);
          return r;
        };

        // Top-level blocks the selection genuinely covers (ignore boundary bleed
        // into the next block, which carries no actual text).
        const blocks = [...self.content.children].filter(
          (b) => range.intersectsNode(b) && clampToBlock(b).toString().length > 0,
        );
        if (blocks.length === 0) return;

        // Use the precise (extractContents) path only when the selection is fully
        // inside ONE block and covers just part of it. Anything that spans block
        // boundaries — even a one-position bleed from a triple-click — goes through
        // the in-place whole-block path, which never fragments the document.
        const single = blocks.length === 1 ? blocks[0] : null;
        const within = single &&
          single.contains(range.startContainer) && single.contains(range.endContainer);
        const partial = within && range.toString().trim() !== single.textContent.trim();

        self.history.saveNow();

        if (partial) {
          // Partial selection inside one block — strip only the selected run.
          // (extractContents is safe here: the range can't cross a block boundary.)
          const frag = range.extractContents();
          strip(frag);
          const marker = document.createTextNode('');
          range.insertNode(marker);
          // Split out of any inline wrapper so re-inserted text isn't re-wrapped.
          while (isInline(marker.parentNode)) {
            const wrap = marker.parentNode;
            const after = wrap.cloneNode(false);
            for (let n = marker.nextSibling; n; ) { const next = n.nextSibling; after.appendChild(n); n = next; }
            wrap.parentNode.insertBefore(marker, wrap.nextSibling);
            if (after.childNodes.length) wrap.parentNode.insertBefore(after, marker.nextSibling);
            if (!wrap.textContent) wrap.remove();
          }
          const first = frag.firstChild, last = frag.lastChild;
          marker.parentNode.insertBefore(frag, marker);
          marker.remove();
          if (first && last) {
            const r = document.createRange();
            r.setStartBefore(first);
            r.setEndAfter(last);
            sel.removeAllRanges();
            sel.addRange(r);
          }
        } else {
          // One or more fully-covered blocks — strip each in place and reset
          // heading/quote/callout blocks to paragraphs (lists kept as lists).
          const touched = [];
          for (const b of blocks) {
            strip(b);
            if (isHeading(b) || isQuote(b) || isCallout(b)) {
              const p = document.createElement('p');
              const srcEl = isCallout(b) ? (b.querySelector('.rune-callout-body') || b) : b;
              while (srcEl.firstChild) p.appendChild(srcEl.firstChild);
              b.replaceWith(p);
              touched.push(p);
            } else {
              touched.push(b);
            }
          }
          if (touched.length) {
            const r = document.createRange();
            r.setStartBefore(touched[0]);
            r.setEndAfter(touched[touched.length - 1]);
            sel.removeAllRanges();
            sel.addRange(r);
          }
        }

        // Safety net: drop any empty inline formatting leftovers.
        self.content.querySelectorAll([...INLINE].join(',')).forEach((node) => {
          if (!node.textContent && !node.querySelector('img, br')) node.remove();
        });
        self.content.normalize();
        self._notifyChange();
      },

      // Generic element-based inline mark: wrap the selection in `tag` (with
      // attrs), toggle it off if already wrapped in the same mark, or update the
      // attrs (e.g. recolour a highlight) if wrapped with different attrs.
      toggleMark(tag, attrs = {}) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        if (!self.content.contains(range.commonAncestorContainer)) return;
        self.history.saveNow();

        const existing = _closestTag(range.commonAncestorContainer, tag, self.content);
        if (existing) {
          if (!attrs.class || existing.className === attrs.class) {
            while (existing.firstChild) existing.parentNode.insertBefore(existing.firstChild, existing);
            existing.remove();                       // toggle off
          } else {
            _applyAttrs(existing, attrs);            // recolour / change attrs
          }
          self.content.normalize();
          self._notifyChange();
          return;
        }

        const frag = range.extractContents();
        // collapse any nested same-tag marks so we don't double-wrap
        frag.querySelectorAll(tag).forEach(m => { while (m.firstChild) m.parentNode.insertBefore(m.firstChild, m); m.remove(); });
        const wrapper = document.createElement(tag);
        _applyAttrs(wrapper, attrs);
        wrapper.appendChild(frag);
        range.insertNode(wrapper);
        const r = document.createRange();
        r.selectNodeContents(wrapper);
        sel.removeAllRanges();
        sel.addRange(r);
        self._notifyChange();
      },

      // Links
      setLink(href, text) {
        // Reject dangerous protocols before touching the DOM (single source of
        // truth - same check the sanitizer uses; covers data:image/svg etc.)
        if (!href || _isDangerousUrl(href)) return;
        self.history.saveNow();
        const sel = self.selection.native;
        if (sel && !sel.isCollapsed) {
          document.execCommand('createLink', false, href);
          // Add security attrs to links created via execCommand
          const anchor = sel.anchorNode?.parentElement?.closest('a') ||
            self.content.querySelector(`a[href="${CSS.escape(href)}"]`);
          if (anchor) {
            anchor.setAttribute('target', '_blank');
            anchor.setAttribute('rel', 'noopener noreferrer');
          }
        } else {
          const a = el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text || href);
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
      'aria-label': this.options.ariaLabel,
    });

    // The placeholder is drawn via CSS ::before, which screen readers don't
    // reliably expose — mirror it into aria-placeholder so AT announces it.
    this.content.setAttribute('data-placeholder', this.options.placeholder);
    this.content.setAttribute('aria-placeholder', this.options.placeholder);
    this.wrapper.appendChild(this.content);

    // Opt-out attribution credit (ParityFox). Disable with `attribution: false`.
    if (this.options.attribution) {
      this.wrapper.appendChild(el('a', {
        class: 'rune-attribution',
        href: 'https://parityfox.com',
        target: '_blank',
        rel: 'noopener noreferrer',
        contenteditable: 'false',
        'aria-label': 'Made with Rune by ParityFox',
      }, 'Made with Rune'));
    }

    // Visually-hidden polite live region for screen-reader announcements (#63).
    this.live = el('div', { class: 'rune-live-region', 'aria-live': 'polite', 'aria-atomic': 'true' });
    this.live.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);border:0;';
    this.wrapper.appendChild(this.live);

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
    // Toolbar is imported dynamically to avoid circular deps. The constructor
    // returns before these promises resolve, so destroy() may run first (fast
    // unmount, React StrictMode double-mount). Bail if the editor is already
    // torn down, otherwise the UI mounts on a dead editor — orphaning body
    // popups and document listeners that nothing ever cleans up.
    if (this.options.toolbar) {
      import('../ui/Toolbar.js').then(({ Toolbar }) => {
        if (this._destroyed) return;
        this.toolbar = new Toolbar(this);
        this.wrapper.prepend(this.toolbar.el);
      });
    }
    if (this.options.bubbleMenu) {
      import('../ui/BubbleMenu.js').then(({ BubbleMenu }) => {
        if (this._destroyed) return;
        this.bubbleMenu = new BubbleMenu(this);
      });
    }
    if (this.options.slashMenu) {
      import('../ui/SlashMenu.js').then(({ SlashMenu }) => {
        if (this._destroyed) return;
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

  _onInput(e) {
    this._ensureContent();
    // Auto-formatting input rules (smart typography, inline markdown…); skip
    // mid-IME-composition. A fired rule handles its own history + change notify.
    if (!e?.isComposing && runInputRules(this, this.schema.getInputRules())) return;
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
    const mod = getModKey();
    if (key === `${mod}+z`) {
      e.preventDefault();
      this.chain().undo().run();
      return;
    }
    if (key === `${mod}+Shift+z` || key === `${mod}+y`) {
      e.preventDefault();
      this.chain().redo().run();
      return;
    }

    // Slash menu trigger
    if (e.key === '/' && this.selection.isCollapsed) {
      this._slashQuery = '';
      this.events.emit('slash:open', { editor: this });
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
    const html  = e.clipboardData?.getData('text/html') || '';
    const plain = e.clipboardData?.getData('text/plain') || '';

    let clean;
    if (!html && plain && this.options.pasteMarkdown !== false && _looksLikeMarkdown(plain)) {
      // No rich HTML on the clipboard, but the text reads as Markdown → convert.
      clean = sanitize(markdownToHtml(plain));
    } else {
      clean = sanitize(html || plain);
    }
    clean = runPasteRules(clean, this.schema.getPasteRules());   // e.g. linkify bare URLs
    document.execCommand('insertHTML', false, clean);
    this._notifyChange();
    this.events.emit('paste', { editor: this });
  }

  _onSelectionChange() {
    if (this._destroyed || this._selRaf) return;
    // document 'selectionchange' fires on every caret move and every keystroke;
    // coalesce bursts into one emit per animation frame.
    this._selRaf = requestAnimationFrame(() => {
      this._selRaf = null;
      if (this._destroyed) return;
      this.events.emit('selectionchange', { editor: this });
    });
  }

  // ─── Core Utilities ──────────────────────────────────────────────────────

  _keyString(e) {
    const parts = [];
    if (e.metaKey) parts.push('Meta');
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
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
    if (this._ready && typeof this.options.onChange === 'function') {
      this.options.onChange(html, this);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /** Announce a message to assistive technology via the live region. */
  announce(msg) {
    if (this.live) this.live.textContent = msg;
  }

  _announceCommand(name) {
    const label = _CMD_LABELS[name];
    if (!label) return;
    if (name.startsWith('toggle')) {
      const type = name.slice(6, 7).toLowerCase() + name.slice(7);
      this.announce(`${label} ${this.isActive(type) ? 'on' : 'off'}`);
    } else {
      this.announce(label);
    }
  }

  /** Execute a command by name. */
  cmd(name, ...args) {
    const fn = this.commands.get(name);
    if (!fn) { console.warn(`[Rune] Unknown command: "${name}"`); return false; }
    const result = fn(...args);
    this._announceCommand(name);
    return result;
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
    if (block) {
      const blockExt = this.schema.resolveBlock(block);
      if (blockExt && blockExt.name === type) return true;
    }

    const mark = this.schema.getMark(type);
    if (mark) {
      // Legacy execCommand marks (bold/italic/…)
      if (mark.execCommand) {
        try { return document.queryCommandState(mark.execCommand); } catch { return false; }
      }
      // Element-based marks (highlight, colour, font…): walk ancestors for a
      // node the mark recognises via its hasMark/match predicate.
      const pred = mark.hasMark || mark.match;
      if (pred) {
        let node = this.selection.getFocusNode();
        while (node && node !== this.content) {
          if (node.nodeType === 1 && pred(node)) return true;
          node = node.parentNode;
        }
      }
    }
    return false;
  }

  /**
   * Swap the undo/redo implementation. Disposes the previous one. `impl` must
   * satisfy the EditorHistory contract (see core/History.js). Used by the
   * collaborative-editing binding to install a Yjs UndoManager adapter.
   * @param {import('./History.js').EditorHistory} impl
   */
  replaceHistory(impl) {
    if (!impl || impl === this.history) return;
    this.history?.destroy?.();
    this.history = impl;
  }

  /** Get editor HTML content. */
  getHtml() {
    // Serialize directly — this runs on every change (and per keystroke via
    // _notifyChange), so the previous cloneNode(true) was an O(document) copy
    // with no purpose (nothing was cleaned off the clone).
    return this.content.innerHTML;
  }

  /** Set editor HTML content. */
  setHtml(html) {
    this.content.innerHTML = normalizeHtml(sanitizeContent(html));
    this._ensureContent();
    this.history.saveNow();
    // Route through _notifyChange so the onChange callback fires too — not just
    // the 'change' event. Framework bindings that mirror editor state rely on it.
    this._notifyChange();
  }

  /** Get plain text. */
  getText() {
    return this.content.innerText;
  }

  /** Convert editor content to Markdown. */
  getMarkdown() {
    return htmlToMarkdown(this.getHtml());
  }

  /** Replace the editor content from a Markdown string. */
  setMarkdown(md) {
    this.setHtml(markdownToHtml(md));
  }

  /** Insert Markdown at the caret. */
  insertMarkdown(md) {
    const clean = sanitize(markdownToHtml(md));
    this.content.focus();
    document.execCommand('insertHTML', false, clean);
    this._notifyChange();
  }

  /** Open browser print dialog with clean editor styles. */
  print() {
    const html   = sanitize(this.getHtml()).replace(/<script[\s>][\s\S]*?<\/script>/gi, '');
    const styles = [...document.styleSheets]
      .map(ss => {
        try { return [...ss.cssRules].map(r => r.cssText).join('\n'); }
        catch { return ''; }
      }).join('\n').replace(/<\/style/gi, '<\\/style');

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Print</title>
  <style>
    ${styles}
    body { margin: 0; background: #fff; }
    .rune-editor { box-shadow: none !important; border: none !important; }
    .rune-toolbar, .rune-bubble-menu, .rune-slash-menu,
    .rune-drag-handle, .rune-drop-indicator, .rune-fr-panel { display: none !important; }
    .rune-content { padding: 40px 60px !important; max-width: 100% !important; }
    @media print { @page { margin: 20mm; } body { print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="rune-editor">
    <div class="rune-content">${html}</div>
  </div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`);
    win.document.close();
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
    cancelAnimationFrame(this._selRaf);
    this.events.emit('destroy');
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
    this.history?.destroy?.();
  }
}
