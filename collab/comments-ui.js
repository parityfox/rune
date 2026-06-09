import { flattenHosts, blockHostAt, textIndexInHost, domPointInHost } from './paragraph-binding.js';

/**
 * Comments UI (#14) — renders highlights for anchored threads over an editor and
 * creates threads from the current selection. Highlights live in an overlay
 * outside the editable tree (never in getHtml() / the reconciler). Pairs with
 * CommentStore (collab/comments.js).
 */
export function bindCommentsUI(editor, doc, store, { onChange } = {}) {
  const content = editor.content;
  const wrapper = editor.wrapper || content.parentElement;
  if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
  const cdoc = content.ownerDocument;

  const layer = cdoc.createElement('div');
  layer.className = 'rune-comment-layer';
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3;';
  wrapper.appendChild(layer);

  function render() {
    layer.textContent = '';
    const wr = wrapper.getBoundingClientRect();
    const hosts = flattenHosts(content);
    const threads = store.list();
    for (const t of threads) {
      if (t.resolved || t.orphaned) continue;
      const host = hosts.find((h) => h.el.getAttribute('data-id') === t.blockId)?.host;
      if (!host) continue;
      const p1 = domPointInHost(host, t.from);
      const p2 = domPointInHost(host, t.to);
      if (!p1 || !p2) continue;
      const rg = cdoc.createRange();
      rg.setStart(p1.node, p1.off); rg.setEnd(p2.node, p2.off);
      for (const rect of rg.getClientRects()) {
        const el = cdoc.createElement('div');
        el.style.cssText = `position:absolute;left:${rect.left - wr.left + wrapper.scrollLeft}px;top:${rect.top - wr.top + wrapper.scrollTop}px;width:${rect.width}px;height:${rect.height}px;background:rgba(234,179,8,0.28);border-bottom:2px solid #eab308;`;
        layer.appendChild(el);
      }
    }
    onChange?.(threads);
  }

  /** Create a thread from the current (single-block) selection. */
  function addFromSelection(author, text) {
    const sel = cdoc.defaultView.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    if (!content.contains(r.startContainer) || !content.contains(r.endContainer)) return null;
    const b1 = blockHostAt(content, r.startContainer);
    const b2 = blockHostAt(content, r.endContainer);
    if (!b1 || !b2 || b1.index !== b2.index) return null;   // single block for v1
    const a = textIndexInHost(b1.host, r.startContainer, r.startOffset);
    const z = textIndexInHost(b1.host, r.endContainer, r.endOffset);
    const blockId = doc.getArray('blocks').get(b1.index).get('id');
    return store.add({ blockId, from: Math.min(a, z), to: Math.max(a, z), text, author });
  }

  // Coalesce renders (full getClientRects pass) to one per frame; store changes
  // and resizes can burst.
  const _win = cdoc.defaultView || globalThis;
  let _renderRaf = null;
  const scheduleRender = () => {
    if (_renderRaf) return;
    _renderRaf = _win.requestAnimationFrame(() => { _renderRaf = null; render(); });
  };

  store.observe(scheduleRender);
  const onResize = () => scheduleRender();
  cdoc.defaultView.addEventListener('resize', onResize);
  render();

  let _destroyed = false;
  const api = {
    render,
    addFromSelection,
    destroy() {
      if (_destroyed) return;
      _destroyed = true;
      _win.cancelAnimationFrame?.(_renderRaf);
      store.unobserve(scheduleRender);
      cdoc.defaultView.removeEventListener('resize', onResize);
      layer.remove();
    },
  };
  editor.events.on('destroy', api.destroy);
  return api;
}
