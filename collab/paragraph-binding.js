import * as Y from 'yjs';
import { uid } from '../src/utils/id.js';
import { MARKS, markForTag, sameAttrs, blockTypeForEl, isPlain, kindOf, BLOCKS } from './schema.js';

/**
 * Collab spike binding (#11) — driven by the central schema (collab/schema.js).
 *
 * Model: `doc.getArray('blocks')` of `Y.Map { type, listType?, text: Y.Text }`.
 *   type ∈ p | h1..h6 | blockquote | li | pre.  Inline marks are Yjs text-
 *   formatting attributes on `text` (see schema MARKS). `pre` (code block) is
 *   plain text — no marks. Consecutive `li` blocks with the same `listType`
 *   render as one <ul>/<ol>.
 *
 * Blocks are keyed by a stable `data-id`, so concurrent insert/delete/reorder
 * reconciles by id. Remote changes apply by MINIMAL PATCHING: existing block
 * elements are reused, inline re-rendered only when it changed, reorder via
 * moves — unchanged blocks (and their live selection/IME) are never touched.
 */

const LOCAL = 'local';

const textOf = (delta) => delta.map((o) => o.insert).join('');
const charAttrs = (delta) => {
  const out = [];
  for (const op of delta) for (let i = 0; i < op.insert.length; i++) out.push(op.attributes || {});
  return out;
};

/** Element's inline content -> normalized delta, using the schema's marks. */
function serializeInline(el) {
  const ops = [];
  (function walk(node, attrs) {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) {
        if (c.data.length) ops.push({ insert: c.data, attributes: { ...attrs } });
      } else if (c.nodeType === 1) {
        const mark = markForTag(c.tagName.toLowerCase());
        const next = { ...attrs };
        if (mark) {
          if (mark.value) { const v = mark.read(c); if (v != null) next[mark.key] = v; }
          else next[mark.key] = true;
        }
        walk(c, next);
      }
    }
  })(el, {});
  const merged = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && sameAttrs(last.attributes, op.attributes)) last.insert += op.insert;
    else merged.push({ insert: op.insert, attributes: op.attributes });
  }
  return merged;
}

/** delta -> element inline DOM, nesting marks by schema precedence (outer first). */
function renderInline(el, delta) {
  const doc = el.ownerDocument;
  el.textContent = '';
  if (!delta.length) { el.appendChild(doc.createElement('br')); return; }
  for (const op of delta) {
    let node = doc.createTextNode(op.insert);
    const a = op.attributes || {};
    for (let i = MARKS.length - 1; i >= 0; i--) {       // inner -> outer
      const m = MARKS[i];
      const v = a[m.key];
      if (!v) continue;
      const wrap = m.value ? m.create(doc, v) : m.create(doc);
      if (!wrap) continue;                               // e.g. dangerous link -> keep text, drop mark
      wrap.appendChild(node); node = wrap;
    }
    el.appendChild(node);
  }
}

/** Serialize a block host given its type — plain text for `pre`, else inline marks. */
function serializeHost(host, type) {
  if (isPlain(type)) return host.textContent ? [{ insert: host.textContent }] : [];
  return serializeInline(host);
}

/** Render a block host given its type — code blocks wrap text in <code>. */
function renderHost(el, type, delta) {
  if (isPlain(type)) {
    el.textContent = '';
    const code = el.ownerDocument.createElement('code');
    code.textContent = textOf(delta);
    el.appendChild(code);
    return;
  }
  renderInline(el, delta);
}

/** Reconcile an element's serialized delta into its Y.Text (minimal ops). */
function reconcileText(ytext, newDelta) {
  const oldText = textOf(ytext.toDelta());
  const newText = textOf(newDelta);
  if (oldText !== newText) {
    let a = 0;
    const maxPre = Math.min(oldText.length, newText.length);
    while (a < maxPre && oldText[a] === newText[a]) a++;
    let b = 0;
    const maxSuf = Math.min(oldText.length - a, newText.length - a);
    while (b < maxSuf && oldText[oldText.length - 1 - b] === newText[newText.length - 1 - b]) b++;
    const del = oldText.length - a - b;
    if (del > 0) ytext.delete(a, del);
    const ins = newText.slice(a, newText.length - b);
    if (ins) ytext.insert(a, ins);
  }
  const cur = charAttrs(ytext.toDelta());
  const tgt = charAttrs(newDelta);
  let i = 0;
  while (i < tgt.length) {
    let j = i + 1;
    while (j < tgt.length && sameAttrs(tgt[j], tgt[i])) j++;
    let needs = false;
    for (let k = i; k < j; k++) if (!sameAttrs(cur[k], tgt[k])) { needs = true; break; }
    if (needs) {
      const attrs = {};
      for (const m of MARKS) attrs[m.key] = m.value ? (tgt[i][m.key] || null) : (tgt[i][m.key] ? true : null);
      ytext.format(i, j - i, attrs);
    }
    i = j;
  }
}

// ─── block flattening (lists expand to one block per <li>) ──────────────────

/** Ordered list of block hosts: [{ host, type, listType }]. */
export function flattenHosts(content) {
  const out = [];
  for (const el of content.children) {
    const t = el.tagName.toLowerCase();
    if (t === 'ul' || t === 'ol') {
      const listType = t === 'ul' ? 'bullet' : 'ordered';
      for (const li of el.children) if (li.tagName === 'LI') out.push({ host: li, type: 'li', listType });
    } else {
      const type = blockTypeForEl(el);
      if (type) out.push({ host: el, type, listType: null });
    }
    // other block types are ignored by this spike
  }
  return out;
}

/** Which flattened block a DOM node lives in. */
export function blockHostAt(content, node) {
  const hosts = flattenHosts(content);
  for (let i = 0; i < hosts.length; i++) if (hosts[i].host.contains(node)) return { index: i, ...hosts[i] };
  return null;
}

/** Caret text-offset of (node, offset) within host element. */
export function textIndexInHost(host, node, offset) {
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
  })(host);
  return done ? idx : -1;
}

/** {node, off} for a text offset within host element. */
export function domPointInHost(host, index) {
  let remaining = index, node = null, off = 0;
  (function walk(n) {
    for (const c of n.childNodes) {
      if (node) return;
      if (c.nodeType === 3) {
        if (remaining <= c.data.length) { node = c; off = remaining; return; }
        remaining -= c.data.length;
      } else if (c.nodeType === 1) walk(c);
    }
  })(host);
  return node ? { node, off } : null;
}

// ─── binding ────────────────────────────────────────────────────────────────

export function bindParagraphSpike(editor, doc) {
  const blocks = doc.getArray('blocks');
  const content = editor.content;
  const cdoc = content.ownerDocument;
  const getSel = () => cdoc.defaultView?.getSelection?.() || cdoc.getSelection?.();
  let applyingRemote = false;

  const newBlock = (d) => {
    const m = new Y.Map();
    m.set('id', d.id);
    m.set('type', d.type || 'p');
    if (d.listType) m.set('listType', d.listType);
    if (kindOf(d.type) === 'atomic') m.set('data', d.data || {});
    else m.set('text', new Y.Text());
    return m;
  };

  // Reorder needs delete+reinsert (Yjs Array has no move); clone the block.
  // Rare, and it loses that block's concurrent-merge history — documented.
  const cloneBlock = (m) => {
    const n = new Y.Map();
    n.set('id', m.get('id'));
    n.set('type', m.get('type'));
    if (m.get('listType')) n.set('listType', m.get('listType'));
    if (kindOf(m.get('type')) === 'atomic') {
      n.set('data', { ...(m.get('data') || {}) });
    } else {
      const t = new Y.Text();
      let pos = 0;
      for (const op of m.get('text').toDelta()) { t.insert(pos, op.insert, op.attributes || {}); pos += op.insert.length; }
      n.set('text', t);
    }
    return n;
  };

  // Read DOM blocks, assigning a fresh data-id to any block that lacks one or
  // duplicates another (e.g. a contenteditable split that cloned an id).
  function readDescs() {
    const seen = new Set();
    return flattenHosts(content).map((h) => {
      let id = h.host.getAttribute('data-id');
      if (!id || seen.has(id)) { id = uid(); h.host.setAttribute('data-id', id); }
      seen.add(id);
      const desc = { id, type: h.type, listType: h.listType };
      if (kindOf(h.type) === 'atomic') desc.data = BLOCKS[h.type].read(h.host);
      else desc.delta = serializeHost(h.host, h.type);
      return desc;
    });
  }

  // ---- DOM -> Y (id-keyed structural reconcile) -----------------------------
  function reconcileFromDom() {
    let descs = readDescs();
    if (!descs.length) descs = [{ id: uid(), type: 'p', listType: null, delta: [] }];
    doc.transact(() => {
      const targetIds = new Set(descs.map((d) => d.id));
      // 1. delete blocks no longer present (back to front)
      for (let i = blocks.length - 1; i >= 0; i--) if (!targetIds.has(blocks.get(i).get('id'))) blocks.delete(i, 1);
      // 2. align order by id; insert new blocks, move (clone) reordered ones
      for (let i = 0; i < descs.length; i++) {
        const cur = blocks.get(i);
        if (!cur || cur.get('id') !== descs[i].id) {
          let j = -1;
          for (let k = i + 1; k < blocks.length; k++) if (blocks.get(k).get('id') === descs[i].id) { j = k; break; }
          if (j > i) { const copy = cloneBlock(blocks.get(j)); blocks.delete(j, 1); blocks.insert(i, [copy]); }
          else blocks.insert(i, [newBlock(descs[i])]);
        }
        // 3. reconcile fields on the (now id-matched) block
        const m = blocks.get(i), d = descs[i];
        if (m.get('type') !== d.type) m.set('type', d.type);
        const lt = d.listType || null;
        if ((m.get('listType') || null) !== lt) { if (lt) m.set('listType', lt); else if (m.has('listType')) m.delete('listType'); }
        if (kindOf(d.type) === 'atomic') {
          if (JSON.stringify(m.get('data')) !== JSON.stringify(d.data)) m.set('data', d.data);
        } else {
          reconcileText(m.get('text'), d.delta);
        }
      }
    }, LOCAL);
  }
  // IME: during composition the DOM is mid-flux. Defer DOM->Y reconcile until
  // compositionend, and hold incoming remote patches so we never rebuild the
  // block the user is composing in (which would abort/corrupt the IME).
  let composing = false;
  let pendingRemote = false;

  // Commit only the block the caret sits in (the one just composed) — a whole
  // reconcile would read other blocks' DOM, which may be stale if a remote
  // patch was deferred during composition, and revert it.
  function commitComposingBlock() {
    const sel = getSel();
    if (!sel || !sel.rangeCount) { reconcileFromDom(); return; }
    const r = sel.getRangeAt(0);
    const b = content.contains(r.startContainer) ? blockHostAt(content, r.startContainer) : null;
    if (!b || b.index >= blocks.length) { reconcileFromDom(); return; }
    const m = blocks.get(b.index);
    if (!m.get('text')) { reconcileFromDom(); return; }     // atomic block — nothing to compose
    doc.transact(() => { reconcileText(m.get('text'), serializeHost(b.host, b.type)); }, LOCAL);
  }

  const onInput = () => { if (!applyingRemote && !composing) reconcileFromDom(); };
  const onCompositionStart = () => { composing = true; };
  const onCompositionEnd = () => {
    composing = false;
    if (!applyingRemote) commitComposingBlock();          // 1. commit just the composed block
    if (pendingRemote) {                                  // 2. then apply any deferred remote patch
      pendingRemote = false;
      applyingRemote = true;
      try { renderFromModel(); } finally { applyingRemote = false; }
    }
  };
  content.addEventListener('input', onInput);
  content.addEventListener('compositionstart', onCompositionStart);
  content.addEventListener('compositionend', onCompositionEnd);

  // ---- caret capture (pre-update) -------------------------------------------
  let caret = null;
  function captureCaret() {
    if (applyingRemote) return;
    const sel = getSel();
    if (!sel || !sel.rangeCount) { caret = null; return; }
    const r = sel.getRangeAt(0);
    const b = content.contains(r.startContainer) ? blockHostAt(content, r.startContainer) : null;
    if (!b || b.index >= blocks.length) { caret = null; return; }
    const yt = blocks.get(b.index).get('text');
    const idx = yt ? textIndexInHost(b.host, r.startContainer, r.startOffset) : -1;
    caret = (idx < 0 || !yt) ? null
      : { blockId: blocks.get(b.index).get('id'), rel: Y.createRelativePositionFromTypeIndex(yt, idx) };
  }
  const onBeforeTxn = (txn) => { if (txn.origin !== LOCAL) captureCaret(); };
  doc.on('beforeTransaction', onBeforeTxn);

  // ---- Y -> DOM --------------------------------------------------------------
  function setCaretInHost(host, index, sel) {
    const pt = domPointInHost(host, index);
    const r = cdoc.createRange();
    if (pt) r.setStart(pt.node, pt.off);
    else { r.selectNodeContents(host); r.collapse(false); }
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  // Does element `el`'s current content already equal `delta` (for its type)?
  function inlineMatches(el, type, delta) {
    const cur = serializeHost(el, type);
    if (cur.length !== delta.length) return false;
    for (let k = 0; k < cur.length; k++) {
      if (cur[k].insert !== delta[k].insert || !sameAttrs(cur[k].attributes, delta[k].attributes)) return false;
    }
    return true;
  }

  // Minimal patch: reuse existing block elements by data-id, re-render inline
  // only when it actually changed, and reorder via moves. Unchanged blocks
  // (and any live selection/IME inside them) are never touched.
  function renderFromModel() {
    const cap = caret;
    const rerendered = new Set();

    const existing = new Map();
    for (const { host } of flattenHosts(content)) {
      const id = host.getAttribute('data-id');
      if (id) existing.set(id, host);
    }

    const blockEl = (m, tag, type) => {
      const id = m.get('id');
      // Atomic block (image/…): reuse the existing element if its data matches,
      // else (re)create from the schema. No editable text.
      if (kindOf(type) === 'atomic') {
        const data = m.get('data') || {};
        const el = existing.get(id);
        if (el && el.tagName.toLowerCase() === tag &&
            JSON.stringify(BLOCKS[type].read(el)) === JSON.stringify(data)) return el;
        const made = BLOCKS[type].create(cdoc, data);
        made.setAttribute('data-id', id);
        rerendered.add(id);
        return made;
      }
      const delta = m.get('text').toDelta();
      let el = existing.get(id);
      if (el && el.tagName.toLowerCase() === tag) {
        if (!inlineMatches(el, type, delta)) { renderHost(el, type, delta); rerendered.add(id); }
      } else {
        el = cdoc.createElement(tag);
        el.setAttribute('data-id', id);
        renderHost(el, type, delta);
        rerendered.add(id);
      }
      return el;
    };

    // Build the desired top-level element sequence (consecutive li -> one list).
    const desired = [];
    const n = blocks.length;
    let i = 0;
    while (i < n) {
      const m = blocks.get(i);
      const type = m.get('type') || 'p';
      if (type === 'li') {
        const lt = m.get('listType') || 'bullet';
        const list = cdoc.createElement(lt === 'ordered' ? 'ol' : 'ul');
        while (i < n) {
          const mm = blocks.get(i);
          if ((mm.get('type') || 'p') !== 'li' || (mm.get('listType') || 'bullet') !== lt) break;
          list.appendChild(blockEl(mm, 'li', 'li'));   // moves a reused <li> into this list
          i++;
        }
        desired.push(list);
      } else {
        const tag = BLOCKS[type]?.tag || 'p';
        desired.push(blockEl(m, tag, type));
        i++;
      }
    }
    if (!desired.length) { const p = cdoc.createElement('p'); p.appendChild(cdoc.createElement('br')); desired.push(p); }

    // Reconcile content's top-level children to `desired`: drop extras, move into order.
    const keep = new Set(desired);
    for (const c of [...content.children]) if (!keep.has(c)) content.removeChild(c);
    let next = content.firstChild;
    for (const el of desired) {
      if (next === el) next = el.nextSibling;
      else content.insertBefore(el, next);
    }

    // Restore the caret only if its own block was re-rendered (others are untouched).
    const sel = getSel();
    if (cap && cap.rel && sel && rerendered.has(cap.blockId)) {
      const abs = Y.createAbsolutePositionFromRelativePosition(cap.rel, doc);
      const host = flattenHosts(content).find((h) => h.host.getAttribute('data-id') === cap.blockId)?.host;
      if (abs && host) setCaretInHost(host, abs.index, sel);
    }
  }
  const observer = (_events, txn) => {
    if (txn.origin === LOCAL) return;
    if (composing) { pendingRemote = true; return; }     // defer until compositionend
    applyingRemote = true;
    try { renderFromModel(); } finally { applyingRemote = false; }
  };
  blocks.observeDeep(observer);

  // ---- initial sync ----------------------------------------------------------
  if (blocks.length === 0) reconcileFromDom();
  else { applyingRemote = true; try { renderFromModel(); } finally { applyingRemote = false; } }

  return {
    destroy() {
      content.removeEventListener('input', onInput);
      content.removeEventListener('compositionstart', onCompositionStart);
      content.removeEventListener('compositionend', onCompositionEnd);
      blocks.unobserveDeep(observer);
      doc.off('beforeTransaction', onBeforeTxn);
    },
  };
}

export const _internals = { serializeInline, renderInline, reconcileText, sameAttrs, flattenHosts };
