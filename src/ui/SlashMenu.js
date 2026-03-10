import { el } from '../utils/dom.js';

/**
 * SlashMenu — Notion-style "/" command palette.
 */
export class SlashMenu {
  constructor(editor) {
    this.editor = editor;
    this.el = el('div', { class: 'rune-slash-menu', role: 'listbox', 'aria-label': 'Insert block' });
    this.el.style.display = 'none';
    document.body.appendChild(this.el);

    this._items      = [];
    this._filtered   = [];
    this._activeIndex = 0;
    this._query      = '';
    this._open       = false;
    this._triggerRange = null;
    this._caretRect  = null;

    this._buildItems();
    this._bindEvents();
  }

  _buildItems() {
    this._items = this.editor.schema.getSlashItems();
    const extra = this.editor.options.slashMenu?.items || [];
    this._items = [...this._items, ...extra];
  }

  // ─── Caret position ─────────────────────────────────────────
  // Inserts a tiny invisible span to measure exact cursor coordinates.
  _getCaretRect() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;

    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);

    const span = document.createElement('span');
    span.textContent = '\u200b'; // zero-width space — has height, zero width
    range.insertNode(span);

    const r = span.getBoundingClientRect();
    span.remove();

    return r.height > 0 ? { top: r.top, bottom: r.bottom, left: r.left } : null;
  }

  // ─── Events ──────────────────────────────────────────────────
  _bindEvents() {
    const { editor } = this;

    editor.events.on('slash:open', () => {
      const sel = window.getSelection();
      this._triggerRange = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      this._caretRect    = this._getCaretRect();
      this._query        = '';
      this._open         = true;
      this._filter('');
      this._show();
    });

    editor.events.on('slash:close', () => this._close());

    editor.content.addEventListener('keydown', (e) => {
      if (!this._open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._activeIndex = (this._activeIndex + 1) % (this._filtered.length || 1);
        this._renderList();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._activeIndex = (this._activeIndex - 1 + (this._filtered.length || 1)) % (this._filtered.length || 1);
        this._renderList();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        this._select(this._filtered[this._activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        this._close();
        return;
      }
      if (e.key === 'Backspace') {
        if (this._query.length === 0) {
          this._close();
          document.execCommand('delete');
        } else {
          this._query = this._query.slice(0, -1);
          this._filter(this._query);
        }
        return;
      }
      if (e.key.length === 1) {
        this._query += e.key;
        this._filter(this._query);
      }
    }, true);

    // Close on outside click
    this._outsideClick = (e) => {
      if (this._open && !this.el.contains(e.target)) this._close();
    };
    document.addEventListener('mousedown', this._outsideClick);
  }

  // ─── Filter ──────────────────────────────────────────────────
  _filter(query) {
    const q = query.toLowerCase();
    this._filtered = q
      ? this._items.filter(i =>
          i.title.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q))
      : this._items;
    this._activeIndex = 0;
    this._renderList();
  }

  // ─── Render ──────────────────────────────────────────────────
  _renderList() {
    const menuEl = this.el;
    menuEl.innerHTML = '';

    // Search hint / query display
    const header = el('div', { class: 'rune-slash-header' });
    const hint = this._query
      ? el('span', { class: 'rune-slash-query' }, `/${this._query}`)
      : el('span', { class: 'rune-slash-hint' }, 'Type to filter…');
    header.appendChild(hint);
    menuEl.appendChild(header);

    if (this._filtered.length === 0) {
      menuEl.appendChild(el('div', { class: 'rune-slash-empty' }, 'No results for "' + this._query + '"'));
      return;
    }

    // Section label
    const section = el('div', { class: 'rune-slash-section' }, 'BASIC BLOCKS');
    menuEl.appendChild(section);

    this._filtered.forEach((item, i) => {
      const row = el('div', {
        class: `rune-slash-item${i === this._activeIndex ? ' is-active' : ''}`,
        role: 'option',
        'aria-selected': String(i === this._activeIndex),
      });

      const icon = el('div', { class: 'rune-slash-icon' });
      icon.textContent = item.icon || '•';

      const text = el('div', { class: 'rune-slash-text' });
      const title = el('div', { class: 'rune-slash-title' }, item.title);
      const desc  = el('div', { class: 'rune-slash-desc'  }, item.description || '');
      text.appendChild(title);
      text.appendChild(desc);

      row.appendChild(icon);
      row.appendChild(text);

      row.addEventListener('mouseenter', () => {
        this._activeIndex = i;
        this._renderList();
      });
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._select(item);
      });
      menuEl.appendChild(row);
    });
  }

  // ─── Select ──────────────────────────────────────────────────
  _select(item) {
    if (!item) return;
    this._close();
    this._deleteSlashText();
    item.action(this.editor);
  }

  _deleteSlashText() {
    if (!this._triggerRange) return;
    try {
      const sel = window.getSelection();
      const range = sel.getRangeAt(0).cloneRange();
      const offset = Math.max(0, this._triggerRange.startOffset - 1);
      range.setStart(this._triggerRange.startContainer, offset);
      range.deleteContents();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch { /* ignore */ }
  }

  // ─── Show / hide ─────────────────────────────────────────────
  _show() {
    this._renderList();
    this.el.style.display = 'block';
    // Use rAF so the menu is in the DOM and has dimensions before positioning
    requestAnimationFrame(() => this._position());
  }

  _close() {
    this._open = false;
    this._query = '';
    this.el.classList.remove('is-open');
    setTimeout(() => { this.el.style.display = 'none'; }, 150);
    this.editor.events.emit('slash:closed');
  }

  // ─── Position ────────────────────────────────────────────────
  _position() {
    const menuW = this.el.offsetWidth  || 280;
    const menuH = this.el.offsetHeight || 340;
    const vw    = document.documentElement.clientWidth;
    const vh    = document.documentElement.clientHeight;

    // Prefer exact caret position; fall back to block bottom
    let anchorTop, anchorLeft;
    if (this._caretRect && this._caretRect.bottom > 0) {
      anchorTop  = this._caretRect.bottom;
      anchorLeft = this._caretRect.left;
    } else {
      const block = this.editor.selection.getBlock() || this.editor.content;
      const r = block.getBoundingClientRect();
      anchorTop  = r.bottom;
      anchorLeft = r.left;
    }

    let top  = anchorTop  + 8;
    let left = anchorLeft;

    // Flip upward if overflowing bottom
    if (top + menuH > vh - 8) top = anchorTop - menuH - 8;
    // Keep in horizontal bounds
    if (left + menuW > vw - 8) left = vw - menuW - 8;
    if (left < 8) left = 8;

    this.el.style.top  = `${top}px`;
    this.el.style.left = `${left}px`;
    this.el.classList.add('is-open');
  }

  destroy() {
    document.removeEventListener('mousedown', this._outsideClick);
    this.el.remove();
  }
}
