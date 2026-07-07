import { el } from '../utils/dom.js';

/**
 * Decorations — paint visuals (highlights, comment ranges, search matches,
 * cursors…) OVER the text without mutating the editable DOM, so getHtml() /
 * getMarkdown() / history snapshots stay pristine.
 *
 * Each decoration is a range stored as a serialisable {path, offset} pair and
 * re-projected to client rects (via Range.getClientRects) into an absolutely
 * positioned overlay layer on every change / selectionchange / scroll / resize.
 *
 *   const id = editor.decorations.add({ from, to, class: 'my-hl', type: 'search' });
 *   editor.decorations.fromCurrentSelection('rune-comment-range', { type: 'comment' });
 *   editor.decorations.remove(id);
 *   editor.decorations.clear('search');
 */
export class Decorations {
  constructor(editor) {
    this.editor = editor;
    this._items = new Map();   // id -> { from, to, class, attrs, onClick, type }
    this._seq = 0;
    this._raf = null;

    const wrapper = editor.wrapper;
    if (wrapper && getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
    this.layer = el('div', { class: 'rune-decoration-layer', 'aria-hidden': 'true' });
    this.layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2;';
    wrapper?.appendChild(this.layer);

    this._schedule = () => {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = null; this._render(); });
    };
    editor.events.on('change', this._schedule);
    editor.events.on('selectionchange', this._schedule);
    editor.content.addEventListener('scroll', this._schedule);
    this._win = editor.content.ownerDocument.defaultView || window;
    this._win.addEventListener('resize', this._schedule);
    editor.events.on('destroy', () => this.destroy());
  }

  /** Add a decoration spanning {path,offset} points. Returns an id. */
  add({ from, to, class: cls = 'rune-decoration', attrs = {}, onClick = null, type = null } = {}) {
    if (!from || !to) return null;
    const id = `dec-${++this._seq}`;
    this._items.set(id, { from, to, class: cls, attrs, onClick, type });
    this._schedule();
    return id;
  }

  /** Add a decoration from a live DOM Range (converted to {path,offset} points). */
  addRange(range, opts = {}) {
    if (!range || !this.editor.content.contains(range.commonAncestorContainer)) return null;
    return this.add({
      from: this._point(range.startContainer, range.startOffset),
      to: this._point(range.endContainer, range.endOffset),
      ...opts,
    });
  }

  remove(id) { if (this._items.delete(id)) this._schedule(); }

  /** Clear all decorations, or only those of a given `type`. */
  clear(type) {
    if (type == null) { this._items.clear(); }
    else { for (const [id, d] of this._items) if (d.type === type) this._items.delete(id); }
    this._schedule();
  }

  /** Build a decoration from the current (non-collapsed) selection. */
  fromCurrentSelection(cls, opts = {}) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    if (!this.editor.content.contains(r.commonAncestorContainer)) return null;
    return this.add({
      from: this._point(r.startContainer, r.startOffset),
      to: this._point(r.endContainer, r.endOffset),
      class: cls, ...opts,
    });
  }

  /** Serialise a DOM point to a {path, offset} relative to the content root. */
  _point(node, offset) {
    const path = [];
    let n = node;
    while (n && n !== this.editor.content) {
      const parent = n.parentNode;
      if (!parent) return null;
      path.unshift([...parent.childNodes].indexOf(n));
      n = parent;
    }
    return { path, offset };
  }

  _resolve(point) {
    let n = this.editor.content;
    for (const i of point.path) { n = n?.childNodes[i]; if (!n) return null; }
    const max = n.nodeType === 3 ? n.textContent.length : n.childNodes.length;
    return { node: n, offset: Math.min(point.offset, max) };
  }

  _render() {
    if (this.editor._destroyed) return;
    this.layer.textContent = '';
    if (this._items.size === 0) return;

    const wrap = this.editor.wrapper.getBoundingClientRect();
    const ox = this.editor.wrapper.scrollLeft;
    const oy = this.editor.wrapper.scrollTop;

    for (const [id, d] of this._items) {
      // An endpoint that no longer resolves means the anchor was deleted —
      // drop the decoration, or it leaks and later re-projects onto whatever
      // node ends up at those indices.
      const a = this._resolve(d.from), b = this._resolve(d.to);
      if (!a || !b) { this._items.delete(id); continue; }
      const range = document.createRange();
      try { range.setStart(a.node, a.offset); range.setEnd(b.node, b.offset); } catch { this._items.delete(id); continue; }
      for (const rect of range.getClientRects()) {
        if (!rect.width && !rect.height) continue;
        const span = el('div', { class: d.class });
        span.style.cssText =
          `position:absolute;left:${rect.left - wrap.left + ox}px;top:${rect.top - wrap.top + oy}px;width:${rect.width}px;height:${rect.height}px;`;
        for (const [k, v] of Object.entries(d.attrs)) span.setAttribute(k, v);
        if (d.onClick) {
          span.style.pointerEvents = 'auto';
          span.style.cursor = 'pointer';
          span.addEventListener('mousedown', (e) => { e.preventDefault(); d.onClick(id, e); });
        }
        this.layer.appendChild(span);
      }
    }
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this.editor.events.off('change', this._schedule);
    this.editor.events.off('selectionchange', this._schedule);
    this.editor.content.removeEventListener('scroll', this._schedule);
    this._win.removeEventListener('resize', this._schedule);
    this.layer.remove();
    this._items.clear();
  }
}
