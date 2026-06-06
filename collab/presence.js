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
    let cursor = null;
    const sel = getSelection(content);
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      const b = content.contains(r.startContainer) ? blockHostAt(content, r.startContainer) : null;
      if (b && b.index < blocks.length) {
        const idx = textIndexInHost(b.host, r.startContainer, r.startOffset);
        const block = blocks.get(b.index);
        const yt = block?.get('text');
        if (idx >= 0 && yt) cursor = { block: block.get('id'), rel: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(yt, idx)) };
      }
    }
    awareness.setLocalStateField('cursor', cursor);
    awareness.setLocalStateField('typing', typing);
  }

  function render() {
    layer.textContent = '';
    const roster = [];
    const wr = wrapper.getBoundingClientRect();
    const hosts = flattenHosts(content);
    awareness.getStates().forEach((state, clientId) => {
      const isSelf = clientId === awareness.clientID;
      const user = state.user || {};
      roster.push({ id: clientId, name: user.name, color: user.color, typing: !!state.typing, isSelf });
      if (isSelf || !state.cursor) return;

      const abs = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(state.cursor.rel), doc);
      const host = hosts.find((h) => h.host.getAttribute('data-id') === state.cursor.block)?.host;
      if (!abs || !host) return;
      const pt = domPointInHost(host, abs.index);
      let rect;
      if (pt) { const rg = cdoc.createRange(); rg.setStart(pt.node, pt.off); rg.collapse(true); rect = rg.getBoundingClientRect(); }
      if (!rect || (!rect.height && !rect.width)) rect = host.getBoundingClientRect();
      const x = rect.left - wr.left + wrapper.scrollLeft;
      const y = rect.top - wr.top + wrapper.scrollTop;
      const h = rect.height || 20;
      const col = user.color || '#888';

      const caret = cdoc.createElement('div');
      caret.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:2px;height:${h}px;background:${col};`;
      const label = cdoc.createElement('div');
      label.className = 'rune-presence-label';
      label.textContent = (user.name || 'Anon') + (state.typing ? ' ✎' : '');
      label.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translateY(-100%);background:${col};color:#fff;font:500 10px/1.4 -apple-system,sans-serif;padding:0 5px;border-radius:4px 4px 4px 0;white-space:nowrap;`;
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

  content.addEventListener('input', onInput);
  cdoc.addEventListener('selectionchange', onSel);
  awareness.on('change', render);
  blocks.observeDeep(render);                  // reposition carets when content shifts
  const onResize = () => render();
  cdoc.defaultView?.addEventListener('resize', onResize);

  writeCursor();
  render();

  return {
    destroy() {
      content.removeEventListener('input', onInput);
      cdoc.removeEventListener('selectionchange', onSel);
      awareness.off('change', render);
      blocks.unobserveDeep(render);
      cdoc.defaultView?.removeEventListener('resize', onResize);
      awareness.setLocalState(null);           // remove our presence
      layer.remove();
    },
  };
}
