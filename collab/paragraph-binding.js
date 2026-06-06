import * as Y from 'yjs';
import { _isDangerousUrl } from '../src/utils/html.js';
import { uid } from '../src/utils/id.js';

/**
 * Collab spike binding (#11) — paragraphs, headings, blockquote, lists + marks.
 *
 * Model: `doc.getArray('blocks')` of `Y.Map { type, listType?, text: Y.Text }`.
 *   type ∈ p | h1..h6 | blockquote | li.  Marks are Yjs text-formatting
 *   attributes on `text` (bold/italic/underline/strike/code/link). Consecutive
 *   `li` blocks with the same `listType` render as one <ul>/<ol>.
 *
 * Blocks are keyed by a stable `data-id` (assigned on first sight), so concurrent
 * block insert/delete/reorder reconciles by id — a peer's edit follows its block
 * even as others restructure around it. Remaining spike gap: remote changes still
 * rebuild the block-level DOM wholesale (caret restored via RelativePosition)
 * rather than minimal-patching — a full-#11 concern.
 */

const LOCAL = 'local';
const MARK_KEYS = ['link', 'bold', 'italic', 'underline', 'strike', 'code'];

function sameAttrs(a = {}, b = {}) {
  for (const k of MARK_KEYS) {
    if (k === 'link') { if ((a.link || null) !== (b.link || null)) return false; }
    else if (!!a[k] !== !!b[k]) return false;
  }
  return true;
}

const textOf = (delta) => delta.map((o) => o.insert).join('');
const charAttrs = (delta) => {
  const out = [];
  for (const op of delta) for (let i = 0; i < op.insert.length; i++) out.push(op.attributes || {});
  return out;
};

/** Element's inline content -> normalized delta [{ insert, attributes }]. */
function serializeInline(el) {
  const ops = [];
  (function walk(node, attrs) {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) {
        if (c.data.length) ops.push({ insert: c.data, attributes: { ...attrs } });
      } else if (c.nodeType === 1) {
        const t = c.tagName.toLowerCase();
        const next = { ...attrs };
        if (t === 'strong' || t === 'b') next.bold = true;
        else if (t === 'em' || t === 'i') next.italic = true;
        else if (t === 'u') next.underline = true;
        else if (t === 's' || t === 'strike' || t === 'del') next.strike = true;
        else if (t === 'code') next.code = true;
        else if (t === 'a') { const h = c.getAttribute('href'); if (h && !_isDangerousUrl(h)) next.link = h; }
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

/** delta -> element inline DOM. Deterministic nesting per MARK_KEYS (link outermost). */
function renderInline(el, delta) {
  const doc = el.ownerDocument;
  el.textContent = '';
  if (!delta.length) { el.appendChild(doc.createElement('br')); return; }
  for (const op of delta) {
    let node = doc.createTextNode(op.insert);
    const a = op.attributes || {};
    if (a.code) { const e = doc.createElement('code'); e.appendChild(node); node = e; }
    if (a.strike) { const e = doc.createElement('s'); e.appendChild(node); node = e; }
    if (a.underline) { const e = doc.createElement('u'); e.appendChild(node); node = e; }
    if (a.italic) { const e = doc.createElement('em'); e.appendChild(node); node = e; }
    if (a.bold) { const e = doc.createElement('strong'); e.appendChild(node); node = e; }
    if (a.link && !_isDangerousUrl(a.link)) {
      const e = doc.createElement('a');
      e.setAttribute('href', a.link);
      e.setAttribute('target', '_blank');
      e.setAttribute('rel', 'noopener noreferrer');
      e.appendChild(node); node = e;
    }
    el.appendChild(node);
  }
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
    if (needs) ytext.format(i, j - i, {
      bold: tgt[i].bold ? true : null, italic: tgt[i].italic ? true : null,
      underline: tgt[i].underline ? true : null, strike: tgt[i].strike ? true : null,
      code: tgt[i].code ? true : null, link: tgt[i].link || null,
    });
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
    } else if (t === 'p' || /^h[1-6]$/.test(t) || t === 'blockquote') {
      out.push({ host: el, type: t === 'p' ? 'p' : t, listType: null });
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
    m.set('text', new Y.Text());
    return m;
  };

  // Reorder needs delete+reinsert (Yjs Array has no move); clone the block.
  // Rare, and it loses that block's concurrent-merge history — documented.
  const cloneBlock = (m) => {
    const n = new Y.Map();
    n.set('id', m.get('id'));
    n.set('type', m.get('type'));
    if (m.get('listType')) n.set('listType', m.get('listType'));
    const t = new Y.Text();
    let pos = 0;
    for (const op of m.get('text').toDelta()) { t.insert(pos, op.insert, op.attributes || {}); pos += op.insert.length; }
    n.set('text', t);
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
      return { id, type: h.type, listType: h.listType, delta: serializeInline(h.host) };
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
        reconcileText(m.get('text'), d.delta);
      }
    }, LOCAL);
  }
  const onInput = () => { if (!applyingRemote) reconcileFromDom(); };
  content.addEventListener('input', onInput);

  // ---- caret capture (pre-update) -------------------------------------------
  let caret = null;
  function captureCaret() {
    if (applyingRemote) return;
    const sel = getSel();
    if (!sel || !sel.rangeCount) { caret = null; return; }
    const r = sel.getRangeAt(0);
    const b = content.contains(r.startContainer) ? blockHostAt(content, r.startContainer) : null;
    if (!b || b.index >= blocks.length) { caret = null; return; }
    const idx = textIndexInHost(b.host, r.startContainer, r.startOffset);
    caret = idx < 0 ? null
      : { blockId: blocks.get(b.index).get('id'), rel: Y.createRelativePositionFromTypeIndex(blocks.get(b.index).get('text'), idx) };
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

  function renderFromModel() {
    const cap = caret;
    content.textContent = '';
    const hostsById = Object.create(null);
    const n = blocks.length;
    let i = 0;
    while (i < n) {
      const m = blocks.get(i);
      const type = m.get('type') || 'p';
      if (type === 'li') {
        const listType = m.get('listType') || 'bullet';
        const list = cdoc.createElement(listType === 'ordered' ? 'ol' : 'ul');
        while (i < n) {
          const mm = blocks.get(i);
          if ((mm.get('type') || 'p') !== 'li' || (mm.get('listType') || 'bullet') !== listType) break;
          const li = cdoc.createElement('li');
          li.setAttribute('data-id', mm.get('id'));
          renderInline(li, mm.get('text').toDelta());
          list.appendChild(li);
          hostsById[mm.get('id')] = li; i++;
        }
        content.appendChild(list);
      } else {
        const tag = /^h[1-6]$/.test(type) ? type : (type === 'blockquote' ? 'blockquote' : 'p');
        const el = cdoc.createElement(tag);
        el.setAttribute('data-id', m.get('id'));
        renderInline(el, m.get('text').toDelta());
        content.appendChild(el);
        hostsById[m.get('id')] = el; i++;
      }
    }
    if (!n) { const p = cdoc.createElement('p'); p.appendChild(cdoc.createElement('br')); content.appendChild(p); }
    const sel = getSel();
    if (cap && cap.rel && sel) {
      const abs = Y.createAbsolutePositionFromRelativePosition(cap.rel, doc);
      const host = hostsById[cap.blockId];      // restore caret by stable id, not index
      if (abs && host) setCaretInHost(host, abs.index, sel);
    }
  }
  const observer = (_events, txn) => {
    if (txn.origin === LOCAL) return;
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
      blocks.unobserveDeep(observer);
      doc.off('beforeTransaction', onBeforeTxn);
    },
  };
}

export const _internals = { serializeInline, renderInline, reconcileText, sameAttrs, flattenHosts };
