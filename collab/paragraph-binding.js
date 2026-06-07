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

/** One delta op -> a DOM run node (text wrapped in marks, outer = schema order). */
function makeRunNode(doc, op) {
  let node = doc.createTextNode(op.insert);
  const a = op.attributes || {};
  for (let i = MARKS.length - 1; i >= 0; i--) {         // inner -> outer
    const m = MARKS[i];
    const v = a[m.key];
    if (!v) continue;
    const wrap = m.value ? m.create(doc, v) : m.create(doc);
    if (!wrap) continue;                                 // e.g. dangerous link -> keep text, drop mark
    wrap.appendChild(node); node = wrap;
  }
  return node;
}

/** delta -> element inline DOM (full rebuild), nesting marks by schema precedence. */
function renderInline(el, delta) {
  const doc = el.ownerDocument;
  el.textContent = '';
  if (!delta.length) { el.appendChild(doc.createElement('br')); return; }
  for (const op of delta) el.appendChild(makeRunNode(doc, op));
}

/** Reconstruct {insert, attributes} from a canonical run node (single mark chain
 *  bottoming out at one text node), or null if the node isn't canonical. */
function runOf(node) {
  const attributes = {};
  let n = node;
  while (n && n.nodeType === 1) {
    if (n.childNodes.length !== 1) return null;
    const mark = markForTag(n.tagName.toLowerCase());
    if (!mark) return null;                              // <br>, unknown wrapper, etc. -> not canonical
    if (mark.value) { const v = mark.read(n); if (v == null) return null; attributes[mark.key] = v; }
    else attributes[mark.key] = true;
    n = n.firstChild;
  }
  if (!n || n.nodeType !== 3) return null;
  return { insert: n.data, attributes };
}

const runEq = (a, b) => a.insert === b.insert && sameAttrs(a.attributes, b.attributes);

/**
 * Minimal inline patch (#17): keep DOM nodes for unchanged runs (common prefix +
 * suffix), replace only the changed middle. Returns the replaced character range
 * {lo, hi} in the NEW text, or {lo:0, hi:Infinity} when it fell back to a full
 * rebuild (non-canonical DOM / empty). Preserving unchanged-run nodes lets a
 * selection in them survive a remote edit to a different run of the same block.
 */
function patchInline(el, delta) {
  if (!delta.length) { renderInline(el, delta); return { lo: 0, hi: Infinity }; }
  const nodes = [...el.childNodes];
  const oldRuns = [];
  for (const n of nodes) { const r = runOf(n); if (!r) { renderInline(el, delta); return { lo: 0, hi: Infinity }; } oldRuns.push(r); }
  let p = 0;
  while (p < oldRuns.length && p < delta.length && runEq(oldRuns[p], delta[p])) p++;
  let s = 0;
  while (s < oldRuns.length - p && s < delta.length - p && runEq(oldRuns[oldRuns.length - 1 - s], delta[delta.length - 1 - s])) s++;
  for (let i = oldRuns.length - s - 1; i >= p; i--) el.removeChild(nodes[i]);   // drop changed middle
  const anchor = nodes[oldRuns.length - s] || null;                             // first preserved suffix node
  const doc = el.ownerDocument;
  for (let i = p; i < delta.length - s; i++) el.insertBefore(makeRunNode(doc, delta[i]), anchor);
  let lo = 0; for (let i = 0; i < p; i++) lo += delta[i].insert.length;
  let hi = lo; for (let i = p; i < delta.length - s; i++) hi += delta[i].insert.length;
  return { lo, hi };
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
// Each entry: { el, host, type, listType }. `el` is the top-level block element
// (carries data-id); `host` is the editable region. They differ only for
// `wrapped` blocks (callout: el = wrapper div, host = .rune-callout-body).
export function flattenHosts(content) {
  const out = [];
  for (const el of content.children) {
    const t = el.tagName.toLowerCase();
    if (t === 'ul' || t === 'ol') {
      const listType = t === 'ul' ? 'bullet' : 'ordered';
      for (const li of el.children) if (li.tagName === 'LI') out.push({ el: li, host: li, type: 'li', listType });
    } else if (t === 'table') {
      let r = 0;
      for (const tr of el.querySelectorAll('tr')) {       // each cell is its own block (v1: no nested tables)
        let c = 0;
        for (const cell of tr.children) {
          if (cell.tagName === 'TD' || cell.tagName === 'TH') {
            out.push({ el: cell, host: cell, type: 'cell', listType: null, tableEl: el, r, c, header: cell.tagName === 'TH' });
            c++;
          }
        }
        r++;
      }
    } else {
      const type = blockTypeForEl(el);
      if (type === 'callout') out.push({ el, host: BLOCKS.callout.body(el), type, listType: null });
      else if (type) out.push({ el, host: el, type, listType: null });
    }
    // other block types are ignored by this spike
  }
  return out;
}

/** data-id carried on a flattened block's top-level element. */
const idOfEntry = (h) => h.el.getAttribute('data-id');

/** Which flattened block a DOM node lives in. */
export function blockHostAt(content, node) {
  const hosts = flattenHosts(content);
  for (let i = 0; i < hosts.length; i++) if (hosts[i].host.contains(node)) return { index: i, ...hosts[i] };
  return null;
}

/** Caret text-offset of (node, offset) within host element. */
export function textIndexInHost(host, node, offset) {
  if (node === host) {                     // caret anchored to the block element (offset = child index)
    let sum = 0;
    for (let k = 0; k < offset && k < host.childNodes.length; k++) sum += host.childNodes[k].textContent.length;
    return sum;
  }
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
    const k = kindOf(d.type);
    if (k === 'atomic') m.set('data', d.data || {});
    else {
      m.set('text', new Y.Text());
      if (k === 'wrapped' && d.meta) { m.set('emoji', d.meta.emoji); m.set('color', d.meta.color); }
    }
    if (d.type === 'cell') { m.set('tableId', d.tableId); m.set('r', d.r); m.set('c', d.c); m.set('header', d.header); }
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
      if (kindOf(m.get('type')) === 'wrapped') { n.set('emoji', m.get('emoji')); n.set('color', m.get('color')); }
    }
    if (m.get('type') === 'cell') for (const f of ['tableId', 'r', 'c', 'header']) n.set(f, m.get(f));
    return n;
  };

  // Read DOM blocks, assigning a fresh data-id to any block that lacks one or
  // duplicates another (e.g. a contenteditable split that cloned an id).
  function readDescs() {
    const seen = new Set();
    return flattenHosts(content).map((h) => {
      let id = h.el.getAttribute('data-id');                 // data-id lives on the top-level element
      if (!id || seen.has(id)) { id = uid(); h.el.setAttribute('data-id', id); }
      seen.add(id);
      const desc = { id, type: h.type, listType: h.listType };
      const k = kindOf(h.type);
      if (k === 'atomic') desc.data = BLOCKS[h.type].read(h.el);
      else {
        desc.delta = serializeHost(h.host, h.type);           // serialize the editable region
        if (k === 'wrapped') desc.meta = BLOCKS[h.type].readMeta(h.el);
      }
      if (h.type === 'cell') {
        let tableId = h.tableEl.getAttribute('data-id');      // stable id for grouping cells back into a table
        if (!tableId) { tableId = uid(); h.tableEl.setAttribute('data-id', tableId); }
        desc.tableId = tableId; desc.r = h.r; desc.c = h.c; desc.header = h.header;
      }
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
        const k = kindOf(d.type);
        if (k === 'atomic') {
          if (JSON.stringify(m.get('data')) !== JSON.stringify(d.data)) m.set('data', d.data);
        } else {
          reconcileText(m.get('text'), d.delta);
          if (k === 'wrapped' && d.meta) {
            if (m.get('emoji') !== d.meta.emoji) m.set('emoji', d.meta.emoji);
            if (m.get('color') !== d.meta.color) m.set('color', d.meta.color);
          }
        }
        if (d.type === 'cell') for (const f of ['tableId', 'r', 'c', 'header']) if (m.get(f) !== d[f]) m.set(f, d[f]);
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
    const patched = new Map();          // id -> {lo, hi} char range replaced (Infinity hi = full rebuild)

    const existing = new Map();
    for (const { el } of flattenHosts(content)) {
      const id = el.getAttribute('data-id');               // data-id on the top-level element (cells included)
      if (id) existing.set(id, el);
    }
    const existingTables = new Map();                       // reuse <table> wrappers by data-id
    for (const el of content.children) if (el.tagName === 'TABLE' && el.getAttribute('data-id')) existingTables.set(el.getAttribute('data-id'), el);

    const blockEl = (m, tag, type) => {
      const id = m.get('id');
      const kind = kindOf(type);
      // Atomic block (image/…): reuse the existing element if its data matches,
      // else (re)create from the schema. No editable text.
      if (kind === 'atomic') {
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
      // Wrapped block (callout): top-level wrapper + a separate editable body.
      if (kind === 'wrapped') {
        const spec = BLOCKS[type];
        const meta = { emoji: m.get('emoji'), color: m.get('color') };
        let el = existing.get(id), body;
        if (el && el.tagName.toLowerCase() === tag && el.classList.contains('rune-callout')) {
          spec.applyMeta(el, meta);
          body = spec.body(el);
          if (!inlineMatches(body, type, delta)) { patched.set(id, patchInline(body, delta)); rerendered.add(id); }
        } else {
          const made = spec.createWrapper(cdoc, meta);
          el = made.wrapper; body = made.body;
          el.setAttribute('data-id', id);
          renderInline(body, delta);
          patched.set(id, { lo: 0, hi: Infinity });
          rerendered.add(id);
        }
        return el;
      }
      let el = existing.get(id);
      if (el && el.tagName.toLowerCase() === tag) {
        if (!inlineMatches(el, type, delta)) {
          if (isPlain(type)) { renderHost(el, type, delta); patched.set(id, { lo: 0, hi: Infinity }); }
          else patched.set(id, patchInline(el, delta));   // minimal: keep unchanged-run nodes
          rerendered.add(id);
        }
      } else {
        el = cdoc.createElement(tag);
        el.setAttribute('data-id', id);
        renderHost(el, type, delta);
        patched.set(id, { lo: 0, hi: Infinity });
        rerendered.add(id);
      }
      return el;
    };

    // Group consecutive `cell` blocks (same tableId) back into one <table>. The
    // <table> wrapper + tbody/tr are rebuilt (cheap, no editable content) while
    // the cell elements are REUSED by data-id (their content/caret preserved).
    const buildTable = (tid, cells) => {
      let table = existingTables.get(tid);
      if (!(table && table.tagName === 'TABLE')) {
        table = cdoc.createElement('table');
        table.className = 'rune-table'; table.setAttribute('data-type', 'table'); table.setAttribute('data-id', tid);
      }
      const byRow = new Map();
      for (const cm of cells) { const r = cm.get('r') || 0; if (!byRow.has(r)) byRow.set(r, []); byRow.get(r).push(cm); }
      const tbody = cdoc.createElement('tbody');
      for (const r of [...byRow.keys()].sort((a, b) => a - b)) {
        const tr = cdoc.createElement('tr');
        for (const cm of byRow.get(r).sort((a, b) => (a.get('c') || 0) - (b.get('c') || 0))) {
          const cellEl = blockEl(cm, cm.get('header') ? 'th' : 'td', 'cell');   // reuse by id + patch
          cellEl.classList.add('rune-table-cell');
          tr.appendChild(cellEl);                                                // moves the reused cell here
        }
        tbody.appendChild(tr);
      }
      table.textContent = '';                                                    // drop the old tbody (cells already moved out)
      table.appendChild(tbody);
      return table;
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
      } else if (type === 'cell') {
        const tid = m.get('tableId');
        const cells = [];
        while (i < n) {
          const mm = blocks.get(i);
          if ((mm.get('type')) !== 'cell' || mm.get('tableId') !== tid) break;
          cells.push(mm); i++;
        }
        desired.push(buildTable(tid, cells));
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

    // Restore the caret only if its own block was re-rendered AND the caret fell
    // inside the replaced run range — if it sat in a preserved run, leave the live
    // selection untouched (it still points at the same, unchanged DOM nodes).
    const sel = getSel();
    if (cap && cap.rel && sel && rerendered.has(cap.blockId)) {
      const abs = Y.createAbsolutePositionFromRelativePosition(cap.rel, doc);
      const host = flattenHosts(content).find((h) => idOfEntry(h) === cap.blockId)?.host;
      const range = patched.get(cap.blockId);
      const inReplaced = !range || !abs || (abs.index >= range.lo && abs.index <= range.hi);
      if (abs && host && inReplaced) setCaretInHost(host, abs.index, sel);
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
