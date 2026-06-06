import * as Y from 'yjs';

/**
 * Presence (spike, Phase 2 / #12) — live remote cursors + typing indicators.
 *
 * SPIKE simplification: presence is stored in a shared `Y.Map('presence')` so it
 * rides the same MemoryHub sync channel. The production design (#12) uses the
 * ephemeral y-protocols Awareness instead (presence shouldn't persist in the doc
 * or hit undo). Cursor positions are encoded as Yjs RelativePositions so they
 * stay attached to the right character as the document changes.
 */

const STALE_MS = 10000;
const TYPING_MS = 1200;

const childParagraphs = (content) => [...content.children].filter((el) => el.tagName === 'P');

function getSelection(content) {
  const d = content.ownerDocument;
  return d.defaultView?.getSelection?.() || d.getSelection?.() || null;
}

/** Text offset of the caret within paragraph `p`. */
function textIndex(p, node, offset) {
  let idx = 0, done = false;
  (function walk(n) {
    for (const c of n.childNodes) {
      if (done) return;
      if (c === node) {
        if (c.nodeType === 3) idx += offset;
        else for (let k = 0; k < offset; k++) idx += c.childNodes[k]?.textContent.length || 0;
        done = true; return;
      }
      if (c.nodeType === 3) idx += c.data.length;
      else if (c.nodeType === 1) walk(c);
    }
  })(p);
  return done ? idx : -1;
}

/** {node, offset} for a text offset within paragraph `p`. */
function domPoint(p, index) {
  let remaining = index, node = null, off = 0;
  (function walk(n) {
    for (const c of n.childNodes) {
      if (node) return;
      if (c.nodeType === 3) {
        if (remaining <= c.data.length) { node = c; off = remaining; return; }
        remaining -= c.data.length;
      } else if (c.nodeType === 1) walk(c);
    }
  })(p);
  return node ? { node, off } : null;
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

  let typing = false, typingTimer = null, selThrottle = null;

  function writeSelf() {
    const entry = { name, color, ts: now(), typing };
    const sel = getSelection(content);
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      if (content.contains(r.startContainer)) {
        const ps = childParagraphs(content);
        for (let i = 0; i < ps.length && i < blocks.length; i++) {
          if (ps[i].contains(r.startContainer)) {
            const idx = textIndex(ps[i], r.startContainer, r.startOffset);
            if (idx >= 0) { entry.para = i; entry.rel = Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(blocks.get(i), idx)); }
            break;
          }
        }
      }
    }
    presence.set(meId, entry);
  }

  function render() {
    layer.textContent = '';
    const roster = [];
    const wr = wrapper.getBoundingClientRect();
    presence.forEach((entry, id) => {
      const stale = now() - (entry.ts || 0) > STALE_MS;
      const isSelf = id === meId;
      roster.push({ id, name: entry.name, color: entry.color, typing: !!entry.typing && !stale, isSelf });
      if (isSelf || stale || entry.rel == null) return;

      const abs = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(entry.rel), doc);
      const p = childParagraphs(content)[entry.para ?? 0];
      if (!abs || !p) return;
      const pt = domPoint(p, abs.index);
      let rect;
      if (pt) { const rg = cdoc.createRange(); rg.setStart(pt.node, pt.off); rg.collapse(true); rect = rg.getBoundingClientRect(); }
      if (!rect || (!rect.height && !rect.width)) rect = p.getBoundingClientRect();
      const x = rect.left - wr.left + wrapper.scrollLeft;
      const y = rect.top - wr.top + wrapper.scrollTop;
      const h = rect.height || 20;

      const caret = cdoc.createElement('div');
      caret.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:2px;height:${h}px;background:${entry.color};`;
      const label = cdoc.createElement('div');
      label.className = 'rune-presence-label';
      label.textContent = entry.name + (entry.typing && !stale ? ' ✎' : '');   // ✎ when typing
      label.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translateY(-100%);background:${entry.color};color:#fff;font:500 10px/1.4 -apple-system,sans-serif;padding:0 5px;border-radius:4px 4px 4px 0;white-space:nowrap;`;
      layer.appendChild(caret);
      layer.appendChild(label);
    });
    onChange?.(roster);
  }

  // ---- listeners ----
  const onInput = () => {
    typing = true; writeSelf();
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { typing = false; writeSelf(); }, TYPING_MS);
  };
  const onSel = () => { clearTimeout(selThrottle); selThrottle = setTimeout(writeSelf, 50); };

  content.addEventListener('input', onInput);
  cdoc.addEventListener('selectionchange', onSel);
  presence.observe(render);
  blocks.observeDeep(render);                  // reposition carets when content shifts
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
