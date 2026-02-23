import { el, getSelectionRect } from '../utils/dom.js';

/**
 * BubbleMenu — a floating toolbar that appears on text selection.
 *
 * Shows a subset of toolbar items inline near the selection.
 * Customize which items appear via options.bubbleMenu.items
 */
export class BubbleMenu {
  constructor(editor) {
    this.editor = editor;
    this.el = el('div', { class: 'rune-bubble-menu', role: 'toolbar', 'aria-label': 'Format selection' });
    this.el.style.display = 'none';
    document.body.appendChild(this.el);

    this._openBtn  = null;
    this._popup    = null;

    this._render();
    this._bindEvents();
  }

  _render() {
    this._items = []; // stable refs — used by _updateActive
    const { editor } = this;
    const bubbleOpts = editor.options.bubbleMenu;
    const allItems = editor.schema.getToolbarItems();

    const itemNames = (bubbleOpts && Array.isArray(bubbleOpts.items))
      ? bubbleOpts.items
      : ['bold', 'italic', 'underline', 'strike', 'code', 'link'];

    for (const name of itemNames) {
      if (name === '|') {
        this.el.appendChild(el('div', { class: 'rune-bubble-divider' }));
        continue;
      }
      const item = allItems.find(i => i.name === name);
      if (!item) continue;
      this._items.push(item);

      if (item.type === 'panel') {
        this._renderPanelBtn(item);
      } else {
        this._renderBtn(item);
      }
    }
  }

  _renderBtn(item) {
    const btn = el('button', {
      class: 'rune-bubble-btn',
      type: 'button',
      title: item.title,
      'aria-label': item.title,
    });
    btn.innerHTML = item.icon;

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (item.action) this.editor.cmd(item.action, ...(item.args || []));
      setTimeout(() => this._updateActive(), 10);
    });

    this.el.appendChild(btn);
    item._bubbleEl = btn;
  }

  _renderPanelBtn(item) {
    const btn = el('button', {
      class: 'rune-bubble-btn',
      type: 'button',
      title: item.title,
      'aria-label': item.title,
    });

    const iconWrap = el('span', { class: 'rune-toolbar-panel-icon' });
    iconWrap.innerHTML = item.icon;
    btn.appendChild(iconWrap);

    if (item.indicator) {
      const bar = el('span', { class: 'rune-toolbar-indicator' });
      bar.style.background = item.defaultColor || '#1a1a1a';
      btn.appendChild(bar);
      item._indicatorEl = bar;
    }

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this._openBtn === btn) { this._closePopup(); return; }
      this._closePopup();

      const popup = el('div', { class: 'rune-toolbar-popup rune-popup-panel' });
      popup.appendChild(item.renderPanel(this.editor, () => this._closePopup(), item));
      this._openPopup(btn, popup);
    });

    this.el.appendChild(btn);
    item._bubbleEl = btn;
  }

  // ─── Popup management ──────────────────────────────────────

  _openPopup(btn, popup) {
    document.body.appendChild(popup);
    this._positionPopup(btn, popup);
    this._openBtn = btn;
    this._popup   = popup;
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => popup.classList.add('is-open'));
  }

  _closePopup() {
    if (!this._popup) return;
    this._popup.classList.remove('is-open');
    const popup = this._popup;
    this._popup  = null;
    this._openBtn?.setAttribute('aria-expanded', 'false');
    this._openBtn = null;
    setTimeout(() => popup.remove(), 150);
  }

  _positionPopup(btn, popup) {
    const r  = btn.getBoundingClientRect();
    const pw = popup.offsetWidth  || 200;
    const ph = popup.offsetHeight || 200;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    let top  = r.bottom + 5;
    let left = r.left;

    if (left + pw > vw - 8) left = vw - pw - 8;
    if (left < 8) left = 8;
    if (top + ph > vh - 8) top = r.top - ph - 5;

    popup.style.top  = `${top}px`;
    popup.style.left = `${left}px`;
  }

  // ─── Events ────────────────────────────────────────────────

  _bindEvents() {
    this.editor.events.on('selectionchange', () => this._onSelectionChange());
    this.editor.events.on('change', () => this._updateActive());

    this._outsideClick = (e) => {
      if (this._popup && !this._popup.contains(e.target) && !this._openBtn?.contains(e.target)) {
        this._closePopup();
      }
    };
    document.addEventListener('mousedown', this._outsideClick);
  }

  _onSelectionChange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      this._hide();
      return;
    }

    // Only show if selection is inside the editor
    const range = sel.getRangeAt(0);
    if (!this.editor.content.contains(range.commonAncestorContainer)) {
      this._hide();
      return;
    }

    this._show();
    this._position();
    this._updateActive();
  }

  _show() {
    this.el.style.display = 'flex';
    this.el.classList.add('is-visible');
  }

  _hide() {
    this._closePopup();
    this.el.style.display = 'none';
    this.el.classList.remove('is-visible');
  }

  _position() {
    const rect = getSelectionRect();
    if (!rect) return;

    const menuRect = this.el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;

    // Fixed positioning — viewport coords, no scroll offsets
    let top  = rect.top - menuRect.height - 8;
    let left = rect.left + rect.width / 2 - menuRect.width / 2;

    // Flip below selection if it would go off the top
    if (top < 8) top = rect.bottom + 8;

    // Keep within horizontal bounds
    if (left < 8) left = 8;
    if (left + menuRect.width > vw - 8) left = vw - menuRect.width - 8;

    this.el.style.top  = `${top}px`;
    this.el.style.left = `${left}px`;
  }

  _updateActive() {
    const { editor } = this;
    for (const item of this._items) {
      if (!item._bubbleEl || !item.isActive) continue;
      item._bubbleEl.classList.toggle('is-active', !!item.isActive(editor));
    }
  }

  destroy() {
    this._closePopup();
    document.removeEventListener('mousedown', this._outsideClick);
    this.el.remove();
  }
}
