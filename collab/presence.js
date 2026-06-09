import * as Y from 'yjs';
import { flattenHosts, blockHostAt, textIndexInHost, domPointInHost } from './paragraph-binding.js';

/**
 * Presence (#12) — live remote cursors + typing indicators via the ephemeral
 * y-protocols Awareness. Presence lives off the document (not persisted, not in
 * undo) and auto-expires when a peer goes quiet. Cursor positions are Yjs
 * RelativePositions (JSON-encoded in the awareness state) so they stay attached
 * to the right character as edits land.
 *
 * @param awareness a y-protocols Awareness bound to `doc`.
 */
const TYPING_MS = 1200;

function getSelection(content) {
  const d = content.ownerDocument;
  return d.defaultView?.getSelection?.() || d.getSelection?.() || null;
}

export function bindPresence(editor, doc, awareness, { name = 'Anon', color = '#888', onChange } = {}) {
  const content = editor.content;
  const wrapper = editor.wrapper || content.parentElement;
  if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
  const blocks = doc.getArray('blocks');
  const cdoc = content.ownerDocument;

  const layer = cdoc.createElement('div');
  layer.className = 'rune-presence-layer';
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;';
  wrapper.appendChild(layer);

  awareness.setLocalStateField('user', { name, color });

  let typing = false, typingTimer = null, selThrottle = null;

  function writeCursor() {
    // Encode a DOM point as { block, rel } anchored to that block's Y.Text.
    const pointInfo = (node, offset) => {
      if (!content.contains(node)) return null;
      const b = blockHostAt(content, node);
      if (!b || b.index >= blocks.length) return null;
      const idx = textIndexInHost(b.host, node, offset);
      const yt = blocks.get(b.index)?.get('text');
      if (idx < 0 || !yt) return null;
      return { block: blocks.get(b.index).get('id'), rel: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(yt, idx)) };
    };

    let cursor = null;
    const sel = getSelection(content);
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      const head = pointInfo(r.endContainer, r.endOffset);
      const anchor = r.collapsed ? head : pointInfo(r.startContainer, r.startOffset);
      if (head) cursor = { head, anchor: anchor || head, collapsed: r.collapsed };
    }
    awareness.setLocalStateField('cursor', cursor);
    awareness.setLocalStateField('typing', typing);
  }

  function render() {
    layer.textContent = '';
    const roster = [];
    const wr = wrapper.getBoundingClientRect();
    const hosts = flattenHosts(content);

    // Resolve an encoded { block, rel } point to a live DOM point.
    const resolve = (p) => {
      if (!p) return null;
      const abs = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(p.rel), doc);
      const host = hosts.find((h) => h.el.getAttribute('data-id') === p.block)?.host;
      if (!abs || !host) return null;
      const dp = domPointInHost(host, abs.index);
      return dp || { node: host, off: 0 };
    };
    const local = (rect) => ({ x: rect.left - wr.left + wrapper.scrollLeft, y: rect.top - wr.top + wrapper.scrollTop, h: rect.height || 20 });

    awareness.getStates().forEach((state, clientId) => {
      const isSelf = clientId === awareness.clientID;
      const user = state.user || {};
      roster.push({ id: clientId, name: user.name, color: user.color, typing: !!state.typing, isSelf });
      if (isSelf || !state.cursor) return;
      const col = user.color || '#888';

      const headPt = resolve(state.cursor.head);
      if (!headPt) return;
      const anchorPt = state.cursor.collapsed ? headPt : (resolve(state.cursor.anchor) || headPt);

      // selection highlight (range between anchor and head)
      if (!state.cursor.collapsed) {
        const rg = cdoc.createRange();
        try {
          rg.setStart(anchorPt.node, anchorPt.off);
          rg.setEnd(headPt.node, headPt.off);
          if (rg.collapsed) { rg.setStart(headPt.node, headPt.off); rg.setEnd(anchorPt.node, anchorPt.off); }
        } catch { /* boundary order swapped */ rg.setStart(headPt.node, headPt.off); rg.setEnd(anchorPt.node, anchorPt.off); }
        for (const rect of rg.getClientRects()) {
          if (!rect.width && !rect.height) continue;
          const hl = cdoc.createElement('div');
          const p = local(rect);
          hl.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;width:${rect.width}px;height:${rect.height}px;background:${col};opacity:0.22;`;
          layer.appendChild(hl);
        }
      }

      // caret + name label at the head
      const cr = cdoc.createRange(); cr.setStart(headPt.node, headPt.off); cr.collapse(true);
      let rect = cr.getBoundingClientRect();
      if (!rect || (!rect.height && !rect.width)) rect = (hosts.find((h) => h.el.getAttribute('data-id') === state.cursor.head.block)?.host || content).getBoundingClientRect();
      const p = local(rect);
      const caret = cdoc.createElement('div');
      caret.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;width:2px;height:${p.h}px;background:${col};`;
      const label = cdoc.createElement('div');
      label.className = 'rune-presence-label';
      label.textContent = (user.name || 'Anon') + (state.typing ? ' ✎' : '');
      label.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;transform:translateY(-100%);background:${col};color:#fff;font:500 10px/1.4 -apple-system,sans-serif;padding:0 5px;border-radius:4px 4px 4px 0;white-space:nowrap;`;
      layer.appendChild(caret);
      layer.appendChild(label);
    });
    onChange?.(roster);
  }

  const onInput = () => {
    typing = true; writeCursor();
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { typing = false; writeCursor(); }, TYPING_MS);
  };
  const onSel = () => { clearTimeout(selThrottle); selThrottle = setTimeout(writeCursor, 50); };

  // Coalesce renders: render() does a full getClientRects layout pass and runs
  // on every awareness change AND every deep block change (i.e. every local
  // keystroke). Batch bursts into one paint per frame. We must still render on
  // local edits — remote carets are RelativePositions that need re-resolving as
  // text shifts — so this throttles rather than skips.
  const _win = cdoc.defaultView || globalThis;
  let _renderRaf = null;
  const scheduleRender = () => {
    if (_renderRaf) return;
    _renderRaf = _win.requestAnimationFrame(() => { _renderRaf = null; render(); });
  };

  content.addEventListener('input', onInput);
  cdoc.addEventListener('selectionchange', onSel);
  awareness.on('change', scheduleRender);
  blocks.observeDeep(scheduleRender);          // reposition carets when content shifts
  const onResize = () => scheduleRender();
  cdoc.defaultView?.addEventListener('resize', onResize);

  writeCursor();
  render();

  let _destroyed = false;
  const api = {
    destroy() {
      if (_destroyed) return;
      _destroyed = true;
      clearTimeout(typingTimer);
      clearTimeout(selThrottle);
      _win.cancelAnimationFrame?.(_renderRaf);
      content.removeEventListener('input', onInput);
      cdoc.removeEventListener('selectionchange', onSel);
      awareness.off('change', scheduleRender);
      blocks.unobserveDeep(scheduleRender);
      cdoc.defaultView?.removeEventListener('resize', onResize);
      awareness.setLocalState(null);           // remove our presence
      layer.remove();
    },
  };
  editor.events.on('destroy', api.destroy);
  return api;
}
