import { el } from '../utils/dom.js';

// ── Toolbar ───────────────────────────────────────────────────

export class Toolbar {
  constructor(editor) {
    this.editor    = editor;
    this.el        = el('div', { class: 'rune-toolbar', role: 'toolbar', 'aria-label': 'Text formatting' });
    this._openBtn  = null;   // button that opened the current popup
    this._popup    = null;   // the floating popup DOM node (appended to body)
    this._tip      = null;   // per-instance tooltip (not shared across editors)
    this._tipTimer = null;
    this._render();
    this._bindEditorEvents();
  }

  // ── Tooltip (per-instance so destroying one editor can't remove another's) ──
  _getTooltip() {
    if (!this._tip) {
      this._tip = document.createElement('div');
      this._tip.className = 'rune-tooltip';
      document.body.appendChild(this._tip);
    }
    return this._tip;
  }
  _showTooltip(btn, text) {
    clearTimeout(this._tipTimer);
    const tip = this._getTooltip();
    tip.textContent = text;
    tip.classList.add('is-visible');
    const r = btn.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - tr.width / 2;
    if (left < 8) left = 8;
    if (left + tr.width > window.innerWidth - 8) left = window.innerWidth - tr.width - 8;
    tip.style.left = `${left}px`;
    tip.style.top  = `${r.bottom + 6}px`;
  }
  _hideTooltip() {
    clearTimeout(this._tipTimer);
    this._tipTimer = setTimeout(() => this._tip?.classList.remove('is-visible'), 80);
  }
  _attachTooltip(btn, text) {
    btn.addEventListener('mouseenter', () => this._showTooltip(btn, text));
    btn.addEventListener('mouseleave', () => this._hideTooltip());
    btn.addEventListener('mousedown',  () => this._hideTooltip());
  }

  // ─── Render ────────────────────────────────────────────────

  _render() {
    this._items = []; // stable refs — used by _updateActive
    const toolbarOpts = this.editor.options.toolbar;
    const allItems    = this.editor.schema.getToolbarItems();
    const itemNames   = (toolbarOpts && Array.isArray(toolbarOpts.items))
      ? toolbarOpts.items : allItems.map(i => i.name);

    for (const name of itemNames) {
      if (name === '|') { this.el.appendChild(el('div', { class: 'rune-toolbar-divider', 'aria-hidden': 'true' })); continue; }
      const item = allItems.find(i => i.name === name);
      if (!item) continue;
      this._items.push(item);
      if (item.type === 'panel') this._renderPanelButton(item);
      else if (item.dropdown)   this._renderDropdownButton(item);
      else                      this._renderButton(item);
    }
  }

  // Plain button
  _renderButton(item) {
    const btn = el('button', { class: 'rune-toolbar-btn', type: 'button', 'aria-label': item.title });
    // Toggle buttons (those reporting active state) expose aria-pressed so AT
    // announces on/off; dropdowns/panels use aria-expanded instead.
    if (item.isActive) btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = item.icon;
    // mousedown only prevents the default (which would steal the editor's
    // selection); the actual command runs on 'click' so keyboard activation
    // (Enter/Space, which dispatch click but never mousedown) works too.
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => this._runItem(item));
    this._attachTooltip(btn, item.title);
    this.el.appendChild(btn);
    item._el = btn;
  }

  // Dropdown button (heading levels, etc.)
  _renderDropdownButton(item) {
    const btn = el('button', {
      class: 'rune-toolbar-btn rune-toolbar-btn--dropdown', type: 'button',
      'aria-label': item.title, 'aria-haspopup': 'true',
    });
    btn.innerHTML = item.icon + `<svg class="rune-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>`;
    this._attachTooltip(btn, item.title);

    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      if (this._openBtn === btn) { this._closePopup(); return; }
      this._closePopup();

      const popup = el('div', { class: 'rune-toolbar-popup rune-popup-list', role: 'menu' });
      for (const dItem of item.dropdown) {
        const dBtn = el('button', { class: 'rune-toolbar-dropdown-item', type: 'button', role: 'menuitem' }, dItem.label);
        dBtn.addEventListener('mousedown', (ev) => ev.preventDefault());
        dBtn.addEventListener('click', () => {
          this._restoreSelection();
          this.editor.cmd(dItem.action, ...(dItem.args || []));
          this._closePopup();
        });
        popup.appendChild(dBtn);
      }
      this._openPopup(btn, popup);
    });

    this.el.appendChild(btn);
    item._el = btn;
  }

  // Panel button — arbitrary content (colour pickers, font size, image upload)
  _renderPanelButton(item) {
    const btn = el('button', {
      class: 'rune-toolbar-btn rune-toolbar-btn--panel', type: 'button', 'aria-label': item.title,
    });

    const iconWrap = el('span', { class: 'rune-toolbar-panel-icon' });
    iconWrap.innerHTML = item.icon;
    btn.appendChild(iconWrap);

    if (item.indicator) {
      const bar = el('span', { class: 'rune-toolbar-indicator' });
      bar.style.background = item.defaultColor || '#1a1a1a';
      btn.appendChild(bar);
      item._toolbarIndicatorEl = bar;
    }

    this._attachTooltip(btn, item.title);

    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      if (this._openBtn === btn) { this._closePopup(); return; }
      this._closePopup();

      const popup = el('div', { class: 'rune-toolbar-popup rune-popup-panel' });
      popup.appendChild(item.renderPanel(this.editor, () => this._closePopup(), item));
      this._openPopup(btn, popup);
    });

    this.el.appendChild(btn);
    item._el = btn;
  }

  // ─── Popup management (appended to body → never clipped) ───

  _openPopup(btn, popup) {
    document.body.appendChild(popup);
    this._positionPopup(btn, popup);
    this._openBtn = btn;
    this._popup   = popup;
    btn.setAttribute('aria-expanded', 'true');
    // Animate in
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
    const ph = popup.offsetHeight || 260;
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

  // ─── Editor events ─────────────────────────────────────────

  // Run a toolbar item's command, first restoring the editor selection — needed
  // for keyboard activation, where focusing the button collapses the selection.
  _runItem(item) {
    if (!item.action) return;
    this._restoreSelection();
    this.editor.cmd(item.action, ...(item.args || []));
  }

  _restoreSelection() {
    if (!this._savedRange) return;
    this.editor.content.focus();
    try { this.editor.selection.restore(this._savedRange); } catch { /* range went stale */ }
  }

  _bindEditorEvents() {
    this.editor.events.on('selectionchange', () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount &&
          this.editor.content.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        this._savedRange = this.editor.selection.save();   // remember the live editor selection
      }
      this._updateActive();
    });
    this.editor.events.on('change',          () => this._updateActive());

    this._outsideClick = (e) => {
      if (this._popup && !this._popup.contains(e.target) && !this._openBtn?.contains(e.target)) {
        this._closePopup();
      }
    };
    document.addEventListener('mousedown', this._outsideClick);
  }

  _updateActive() {
    for (const item of this._items) {
      if (!item._el || !item.isActive) continue;
      const active = !!item.isActive(this.editor);
      item._el.classList.toggle('is-active', active);
      if (item.type !== 'panel' && !item.dropdown) {
        item._el.setAttribute('aria-pressed', String(active));
      }
    }
  }

  destroy() {
    this._closePopup();
    document.removeEventListener('mousedown', this._outsideClick);
    clearTimeout(this._tipTimer);
    this._tip?.remove();
    this._tip = null;
    this.el.remove();
  }
}
