import * as Y from 'yjs';
import { flattenHosts, blockHostAt, textIndexInHost, domPointInHost } from './paragraph-binding.js';

/**
 * Presence (spike, Phase 2 / #12) — live remote cursors + typing indicators.
 *
 * SPIKE simplification: presence rides a shared `Y.Map('presence')` on the same
 * sync channel. Production (#12) uses the ephemeral y-protocols Awareness so
 * presence doesn't persist in the doc or hit undo. Positions are Yjs
 * RelativePositions so they stay attached to the right character as edits land.
 */

const STALE_MS = 10000;
const TYPING_MS = 1200;

function getSelection(content) {
  const d = content.ownerDocument;
  return d.defaultView?.getSelection?.() || d.getSelection?.() || null;
}

export function bindPresence(editor, doc, { name = 'Anon', color = '#888', onChange, now = () => Date.now() } = {}) {
  const content = editor.content;
  const wrapper = editor.wrapper || content.parentElement;
  if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
  const blocks = doc.getArray('blocks');
  const presence = doc.getMap('presence');
  const meId = String(doc.clientID);
  const cdoc = content.ownerDocument;

  const layer = cdoc.createElement('div');
  layer.className = 'rune-presence-layer';
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;';
  wrapper.appendChild(layer);

  const textOfBlock = (i) => blocks.get(i)?.get('text');

  let typing = false, typingTimer = null, selThrottle = null;

  function writeSelf() {
    const entry = { name, color, ts: now(), typing };
    const sel = getSelection(content);
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      const b = content.contains(r.startContainer) ? blockHostAt(content, r.startContainer) : null;
      if (b && b.index < blocks.length) {
        const idx = textIndexInHost(b.host, r.startContainer, r.startOffset);
        const yt = textOfBlock(b.index);
        if (idx >= 0 && yt) { entry.block = b.index; entry.rel = Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(yt, idx)); }
      }
    }
    presence.set(meId, entry);
  }

  function render() {
    layer.textContent = '';
    const roster = [];
    const wr = wrapper.getBoundingClientRect();
    const hosts = flattenHosts(content);
    presence.forEach((entry, id) => {
      const stale = now() - (entry.ts || 0) > STALE_MS;
      const isSelf = id === meId;
      roster.push({ id, name: entry.name, color: entry.color, typing: !!entry.typing && !stale, isSelf });
      if (isSelf || stale || entry.rel == null) return;

      const abs = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(entry.rel), doc);
      const host = hosts[entry.block ?? 0]?.host;
      if (!abs || !host) return;
      const pt = domPointInHost(host, abs.index);
      let rect;
      if (pt) { const rg = cdoc.createRange(); rg.setStart(pt.node, pt.off); rg.collapse(true); rect = rg.getBoundingClientRect(); }
      if (!rect || (!rect.height && !rect.width)) rect = host.getBoundingClientRect();
      const x = rect.left - wr.left + wrapper.scrollLeft;
      const y = rect.top - wr.top + wrapper.scrollTop;
      const h = rect.height || 20;

      const caret = cdoc.createElement('div');
      caret.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:2px;height:${h}px;background:${entry.color};`;
      const label = cdoc.createElement('div');
      label.className = 'rune-presence-label';
      label.textContent = entry.name + (entry.typing && !stale ? ' ✎' : '');
      label.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translateY(-100%);background:${entry.color};color:#fff;font:500 10px/1.4 -apple-system,sans-serif;padding:0 5px;border-radius:4px 4px 4px 0;white-space:nowrap;`;
      layer.appendChild(caret);
      layer.appendChild(label);
    });
    onChange?.(roster);
  }

  const onInput = () => {
    typing = true; writeSelf();
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { typing = false; writeSelf(); }, TYPING_MS);
  };
  const onSel = () => { clearTimeout(selThrottle); selThrottle = setTimeout(writeSelf, 50); };

  content.addEventListener('input', onInput);
  cdoc.addEventListener('selectionchange', onSel);
  presence.observe(render);
  blocks.observeDeep(render);
  const onResize = () => render();
  cdoc.defaultView?.addEventListener('resize', onResize);

  writeSelf();
  render();

  return {
    destroy() {
      content.removeEventListener('input', onInput);
      cdoc.removeEventListener('selectionchange', onSel);
      presence.unobserve(render);
      blocks.unobserveDeep(render);
      cdoc.defaultView?.removeEventListener('resize', onResize);
      presence.delete(meId);
      layer.remove();
    },
  };
}
