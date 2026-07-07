import * as Y from 'yjs';
import { flattenHosts, blockHostAt, textIndexInHost, domPointInHost } from './paragraph-binding.js';

/**
 * Presence (#12) — live remote cursors + typing indicators via the ephemeral
 * y-protocols Awareness. Cursor positions are Yjs RelativePositions so they stay
 * attached to the right character as edits land.
 *
 * Returns a handle: { getUsers(), on/off('change'), follow(id)/unfollow(),
 * setUser({name,color,avatar}), destroy() }. Roster entries are
 * { id, name, color, avatar, typing, state:'active'|'idle'|'away', cursorBlockId, isSelf }.
 *
 * @param awareness a y-protocols Awareness bound to `doc`.
 */
const TYPING_MS = 1200;
const IDLE_MS   = 30_000;
const AWAY_MS   = 120_000;

// A remote peer controls `user.color`, and it lands in an element's style.cssText
// (a full declaration list). Restrict it to a strict <color> allowlist — hex,
// a bare keyword, or an rgb/hsl(a) function whose contents can't hold a ';', '('
// or letters — so a payload like "red;position:fixed;inset:0;width:100vw" or a
// "url(…)" beacon can't ride the color field into every peer's DOM. Deliberately
// not CSS.supports(): some engines (and happy-dom) accept the injection verbatim.
export function _safeColor(input) {
  const col = typeof input === 'string' ? input.trim() : '';
  if (!col) return '#888';
  return /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$|^(?:rgb|hsl)a?\([\d\s.,%/]+\)$/.test(col) ? col : '#888';
}

// Bound the display fields we broadcast over awareness so a client can't push a
// multi-MB name/avatar that fans out to every peer. Hygiene, not a hard boundary.
const _clipField = (s, n = 256) => (typeof s === 'string' && s.length > n ? s.slice(0, n) : s);
function _safeUser({ name, color, avatar } = {}) {
  return { name: _clipField(name), color: _clipField(color, 64), avatar: _clipField(avatar, 64) };
}

function getSelection(content) {
  const d = content.ownerDocument;
  return d.defaultView?.getSelection?.() || d.getSelection?.() || null;
}

export function bindPresence(editor, doc, awareness, { name = 'Anon', color = '#888', avatar = null, onChange } = {}) {
  const content = editor.content;
  const wrapper = editor.wrapper || content.parentElement;
  if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
  const blocks = doc.getArray('blocks');
  const cdoc = content.ownerDocument;
  const _win = cdoc.defaultView || globalThis;

  const layer = cdoc.createElement('div');
  layer.className = 'rune-presence-layer';
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;';
  wrapper.appendChild(layer);

  awareness.setLocalStateField('user', _safeUser({ name, color, avatar }));
  awareness.setLocalStateField('activity', 'active');

  let typing = false, typingTimer = null, selThrottle = null;
  let idleTimer = null, awayTimer = null;
  let _following = null;
  const _listeners = new Set();

  // ── Activity (active / idle / away) ─────────────────────────
  function bumpActivity() {
    if (awareness.getLocalState()?.activity !== 'active') awareness.setLocalStateField('activity', 'active');
    clearTimeout(idleTimer); clearTimeout(awayTimer);
    idleTimer = setTimeout(() => awareness.setLocalStateField('activity', 'idle'), IDLE_MS);
    awayTimer = setTimeout(() => awareness.setLocalStateField('activity', 'away'), AWAY_MS);
  }

  function writeCursor() {
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

  // ── Roster (data, decoupled from DOM painting) ──────────────
  function computeRoster() {
    const roster = [];
    awareness.getStates().forEach((state, clientId) => {
      const user = state.user || {};
      roster.push({
        id: clientId,
        // color is peer-controlled and flows to style sinks (e.g. PresenceBar's
        // style.background, which accepts url()); launder it here so getUsers()
        // is safe for every consumer, not just the caret-overlay render path.
        name: user.name, color: _safeColor(user.color), avatar: user.avatar,
        typing: !!state.typing,
        state: state.activity || 'active',
        cursorBlockId: state.cursor?.head?.block || null,
        isSelf: clientId === awareness.clientID,
      });
    });
    return roster;
  }

  function emitRoster() {
    const roster = computeRoster();
    onChange?.(roster);
    _listeners.forEach((fn) => { try { fn(roster); } catch { /* ignore */ } });
  }

  // ── Render remote carets/selections (the heavy DOM pass) ────
  function render() {
    layer.textContent = '';
    const wr = wrapper.getBoundingClientRect();
    const hosts = flattenHosts(content);

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
      if (isSelf || !state.cursor || !state.cursor.head) return;       // guard malformed/absent cursor
      const col = _safeColor(user.color);
      const away = state.activity === 'away';

      const headPt = resolve(state.cursor.head);
      if (!headPt) return;
      const anchorPt = state.cursor.collapsed ? headPt : (resolve(state.cursor.anchor) || headPt);

      if (!state.cursor.collapsed) {
        const rg = cdoc.createRange();
        try {
          rg.setStart(anchorPt.node, anchorPt.off);
          rg.setEnd(headPt.node, headPt.off);
          if (rg.collapsed) { rg.setStart(headPt.node, headPt.off); rg.setEnd(anchorPt.node, anchorPt.off); }
        } catch { rg.setStart(headPt.node, headPt.off); rg.setEnd(anchorPt.node, anchorPt.off); }
        for (const rect of rg.getClientRects()) {
          if (!rect.width && !rect.height) continue;
          const hl = cdoc.createElement('div');
          const p = local(rect);
          hl.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;width:${rect.width}px;height:${rect.height}px;background:${col};opacity:0.22;`;
          layer.appendChild(hl);
        }
      }

      const cr = cdoc.createRange(); cr.setStart(headPt.node, headPt.off); cr.collapse(true);
      let rect = cr.getBoundingClientRect();
      if (!rect || (!rect.height && !rect.width)) rect = (hosts.find((h) => h.el.getAttribute('data-id') === state.cursor.head.block)?.host || content).getBoundingClientRect();
      const p = local(rect);
      const caret = cdoc.createElement('div');
      caret.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;width:2px;height:${p.h}px;background:${col};opacity:${away ? 0.4 : 1};`;
      const label = cdoc.createElement('div');
      label.className = 'rune-presence-label';
      label.textContent = (user.avatar ? user.avatar + ' ' : '') + (user.name || 'Anon') + (state.typing ? ' ✎' : '');
      label.style.cssText = `position:absolute;left:${p.x}px;top:${p.y}px;transform:translateY(-100%);background:${col};color:#fff;font:500 10px/1.4 -apple-system,sans-serif;padding:0 5px;border-radius:4px 4px 4px 0;white-space:nowrap;opacity:${away ? 0.5 : 1};`;
      layer.appendChild(caret);
      layer.appendChild(label);

      // Follow-mode: keep the followed peer's caret in view.
      if (_following != null && clientId === _following) {
        try { (headPt.node.nodeType === 1 ? headPt.node : headPt.node.parentElement)?.scrollIntoView?.({ block: 'nearest' }); } catch { /* ignore */ }
      }
    });
  }

  const onInput = () => {
    typing = true; bumpActivity(); writeCursor();
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { typing = false; writeCursor(); }, TYPING_MS);
  };
  const onSel = () => { bumpActivity(); clearTimeout(selThrottle); selThrottle = setTimeout(writeCursor, 50); };

  let _renderRaf = null;
  const scheduleRender = () => {
    if (_renderRaf) return;
    _renderRaf = _win.requestAnimationFrame(() => { _renderRaf = null; render(); });
  };
  const onAwareness = () => { emitRoster(); scheduleRender(); };

  content.addEventListener('input', onInput);
  cdoc.addEventListener('selectionchange', onSel);
  awareness.on('change', onAwareness);
  blocks.observeDeep(scheduleRender);
  const onResize = () => scheduleRender();
  cdoc.defaultView?.addEventListener('resize', onResize);

  bumpActivity();
  writeCursor();
  render();
  emitRoster();

  let _destroyed = false;
  const api = {
    /** Current roster of connected users (incl. self). */
    getUsers: computeRoster,
    /** Subscribe to roster changes. Returns an unsubscribe function. */
    on(event, fn) { if (event === 'change') { _listeners.add(fn); } return () => _listeners.delete(fn); },
    off(event, fn) { if (event === 'change') _listeners.delete(fn); },
    /** Scroll to keep a peer's caret in view until unfollow(). */
    follow(id) { _following = id; scheduleRender(); },
    unfollow() { _following = null; },
    /** Update the local user's name/color/avatar. */
    setUser(patch) { awareness.setLocalStateField('user', _safeUser({ name, color, avatar, ...patch })); },
    destroy() {
      if (_destroyed) return;
      _destroyed = true;
      clearTimeout(typingTimer); clearTimeout(selThrottle);
      clearTimeout(idleTimer); clearTimeout(awayTimer);
      _win.cancelAnimationFrame?.(_renderRaf);
      content.removeEventListener('input', onInput);
      cdoc.removeEventListener('selectionchange', onSel);
      awareness.off('change', onAwareness);
      blocks.unobserveDeep(scheduleRender);
      cdoc.defaultView?.removeEventListener('resize', onResize);
      awareness.setLocalState(null);
      _listeners.clear();
      layer.remove();
    },
  };
  editor.events.on('destroy', api.destroy);
  return api;
}
