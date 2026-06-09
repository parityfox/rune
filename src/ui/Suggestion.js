import { el } from '../utils/dom.js';

/**
 * Suggestion — a generic trigger-character autocomplete controller.
 *
 * Extensions register a `suggestion` config; one Suggestion instance drives the
 * popup, keyboard navigation, and item selection for all of them:
 *
 *   suggestion: {
 *     char: '@',                 // trigger character
 *     allowSpaces: false,        // can the query contain spaces?
 *     startOfLine: false,        // only trigger at the start of the block?
 *     items: ({ query, editor }) => item[] | Promise<item[]>,
 *     render: (item) => HTMLElement,
 *     command: ({ editor, item, range }) => void,   // range covers "@query"
 *   }
 *
 * Powers @mentions, #hashtags, and :emoji, and could re-express the slash menu.
 */
export class Suggestion {
  constructor(editor, configs) {
    this.editor = editor;
    this.configs = configs || [];
    this.el = el('div', { class: 'rune-suggestion-menu', role: 'listbox' });
    this.el.style.display = 'none';
    document.body.appendChild(this.el);

    this._ctx = null;       // { cfg, node, start, end, query }
    this._items = [];
    this._index = 0;
    this._token = 0;        // guards async item fetches against staleness

    this._onInput = () => this._detect();
    this._onKeydown = (e) => this._onKey(e);
    this._outside = (e) => { if (this._ctx && !this.el.contains(e.target)) this._close(); };

    editor.content.addEventListener('input', this._onInput);
    editor.content.addEventListener('keydown', this._onKeydown, true);
    document.addEventListener('mousedown', this._outside);
    editor.events.on('destroy', () => this.destroy());
  }

  // ── Trigger detection ───────────────────────────────────────
  _detect() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return this._close();
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !this.editor.content.contains(node)) return this._close();

    const before = node.textContent.slice(0, range.startOffset);
    for (const cfg of this.configs) {
      const m = this._match(before, cfg);
      if (m) { this._open(cfg, node, m.start, range.startOffset, m.query); return; }
    }
    this._close();
  }

  _match(before, cfg) {
    const ch = cfg.char;
    const idx = before.lastIndexOf(ch);
    if (idx === -1) return null;
    if (cfg.startOfLine && idx !== 0) return null;
    if (idx > 0 && !/\s/.test(before[idx - 1])) return null;     // start or after whitespace
    const query = before.slice(idx + ch.length);
    if (!cfg.allowSpaces && /\s/.test(query)) return null;
    return { start: idx, query };
  }

  // ── Open / fetch / render ───────────────────────────────────
  async _open(cfg, node, start, end, query) {
    this._ctx = { cfg, node, start, end, query };
    const token = ++this._token;
    let items;
    try { items = await cfg.items({ query, editor: this.editor }); }
    catch { items = []; }
    if (token !== this._token || !this._ctx) return;             // stale / closed
    this._items = items || [];
    this._index = 0;
    this._render();
  }

  _render() {
    this.el.textContent = '';
    if (!this._items.length) { this._close(); return; }
    this._items.forEach((item, i) => {
      const row = el('div', { class: `rune-suggestion-item${i === this._index ? ' is-active' : ''}`, role: 'option' });
      row.appendChild(this._ctx.cfg.render(item));
      row.addEventListener('mouseenter', () => { this._index = i; this._render(); });
      row.addEventListener('mousedown', (e) => { e.preventDefault(); this._select(item); });
      this.el.appendChild(row);
    });
    this.el.style.display = 'block';
    this._position();
  }

  _position() {
    const rect = this._caretRect();
    if (!rect) return;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const w = this.el.offsetWidth || 220;
    const h = this.el.offsetHeight || 200;
    let top = rect.bottom + 4, left = rect.left;
    if (top + h > vh - 8) top = rect.top - h - 4;
    if (left + w > vw - 8) left = vw - w - 8;
    this.el.style.top = `${top}px`;
    this.el.style.left = `${Math.max(8, left)}px`;
  }

  _caretRect() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0).cloneRange();
    r.collapse(true);
    let rect = r.getBoundingClientRect();        // caret rect — no DOM mutation
    if (!rect || (!rect.height && !rect.width)) {
      const block = this.editor.selection?.getBlock?.();
      rect = block ? block.getBoundingClientRect() : null;
    }
    return rect && (rect.height || rect.width) ? rect : null;
  }

  // ── Keyboard ────────────────────────────────────────────────
  _onKey(e) {
    if (!this._ctx || !this._items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); this._index = (this._index + 1) % this._items.length; this._render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this._index = (this._index - 1 + this._items.length) % this._items.length; this._render(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this._select(this._items[this._index]); }
    else if (e.key === 'Escape') { e.preventDefault(); this._close(); }
  }

  _select(item) {
    if (!item || !this._ctx) return;
    const { cfg, node, start, end } = this._ctx;
    const range = document.createRange();
    try {
      range.setStart(node, start);
      range.setEnd(node, Math.min(end, node.textContent.length));
    } catch { this._close(); return; }
    this.editor.history.saveNow();
    cfg.command({ editor: this.editor, item, range });
    this._close();
  }

  _close() {
    this._ctx = null;
    this._items = [];
    this._token++;
    this.el.style.display = 'none';
    this.el.textContent = '';
  }

  destroy() {
    this.editor.content.removeEventListener('input', this._onInput);
    this.editor.content.removeEventListener('keydown', this._onKeydown, true);
    document.removeEventListener('mousedown', this._outside);
    this.el.remove();
  }
}
