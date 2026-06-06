import * as Y from 'yjs';
import { _isDangerousUrl } from '../src/utils/html.js';

/**
 * Phase-1 SPIKE binding (#11) — scope: paragraphs + inline marks.
 *
 * Goal: prove end-to-end that a *model-less* contenteditable can bind to Yjs
 * with (a) convergence under concurrent edits and (b) caret preservation across
 * remote edits — before committing to the full schema (#10) and binding (#11).
 *
 * Model: `doc.getArray('blocks')` of `Y.Text`, one per `<p>`. Marks are Yjs
 * text-formatting attributes (bold/italic/underline/strike/code/link). Block i
 * <-> content paragraph i.
 *
 * NOT production: paragraph identity is by index (no data-id yet); the Y->DOM
 * step re-renders a changed paragraph wholesale (caret restored via
 * RelativePosition) rather than minimal-patching. Those are full-#11 concerns.
 */

const LOCAL = 'local';

// Mark precedence: outermost first. Determines deterministic nesting on render.
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

/** <p> inline DOM -> normalized delta [{ insert, attributes }]. */
function serialize(p) {
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
        walk(c, next);                       // <br> has no children -> contributes nothing
      }
    }
  })(p, {});
  const merged = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && sameAttrs(last.attributes, op.attributes)) last.insert += op.insert;
    else merged.push({ insert: op.insert, attributes: op.attributes });
  }
  return merged;
}

/** delta -> <p> inline DOM. Deterministic nesting per MARK_KEYS (link outermost). */
function render(p, delta) {
  const doc = p.ownerDocument;
  p.textContent = '';
  if (!delta.length) { p.appendChild(doc.createElement('br')); return; }
  for (const op of delta) {
    let node = doc.createTextNode(op.insert);
    const a = op.attributes || {};
    // wrap inner -> outer (reverse precedence)
    if (a.code) { const e = doc.createElement('code'); e.appendChild(node); node = e; }
    if (a.strike) { const e = doc.createElement('s'); e.appendChild(node); node = e; }
    if (a.underline) { const e = doc.createElement('u'); e.appendChild(node); node = e; }
    if (a.italic) { const e = doc.createElement('em'); e.appendChild(node); node = e; }
    if (a.bold) { const e = doc.createElement('strong'); e.appendChild(node); node = e; }
    // link outermost — security: only materialize a safe href
    if (a.link && !_isDangerousUrl(a.link)) {
      const e = doc.createElement('a');
      e.setAttribute('href', a.link);
      e.setAttribute('target', '_blank');
      e.setAttribute('rel', 'noopener noreferrer');
      e.appendChild(node); node = e;
    }
    p.appendChild(node);
  }
}

/** Reconcile one paragraph's serialized delta into its Y.Text (minimal ops). */
function reconcileText(ytext, newDelta) {
  const oldText = textOf(ytext.toDelta());
  const newText = textOf(newDelta);

  // 1. Text: common prefix/suffix diff -> single delete + insert.
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

  // 2. Formatting: format each maximal constant-attr target run that differs.
  const cur = charAttrs(ytext.toDelta());
  const tgt = charAttrs(newDelta);
  let i = 0;
  while (i < tgt.length) {
    let j = i + 1;
    while (j < tgt.length && sameAttrs(tgt[j], tgt[i])) j++;
    let needs = false;
    for (let k = i; k < j; k++) if (!sameAttrs(cur[k], tgt[k])) { needs = true; break; }
    if (needs) ytext.format(i, j - i, {
      bold: tgt[i].bold ? true : null,
      italic: tgt[i].italic ? true : null,
      underline: tgt[i].underline ? true : null,
      strike: tgt[i].strike ? true : null,
      code: tgt[i].code ? true : null,
      link: tgt[i].link || null,
    });
    i = j;
  }
}

const childParagraphs = (content) => [...content.children].filter((el) => el.tagName === 'P');

/** Caret text-offset within paragraph `p`, or -1 if the selection isn't in it. */
function caretIndexInPara(p, sel) {
  if (!sel || sel.rangeCount === 0) return -1;
  const r = sel.getRangeAt(0);
  if (!p.contains(r.startContainer)) return -1;
  let idx = 0, done = false;
  (function walk(node) {
    for (const c of node.childNodes) {
      if (done) return;
      if (c === r.startContainer) {
        if (c.nodeType === 3) idx += r.startOffset;
        else for (let k = 0; k < r.startOffset; k++) idx += c.childNodes[k]?.textContent.length || 0;
        done = true; return;
      }
      if (c.nodeType === 3) idx += c.data.length;
      else if (c.nodeType === 1) walk(c);
    }
  })(p);
  return done ? idx : -1;
}

/** Place the caret at text-offset `index` within paragraph `p`. */
function setCaretInPara(p, index, sel) {
  let remaining = index, target = null, off = 0;
  (function walk(node) {
    for (const c of node.childNodes) {
      if (target) return;
      if (c.nodeType === 3) {
        if (remaining <= c.data.length) { target = c; off = remaining; return; }
        remaining -= c.data.length;
      } else if (c.nodeType === 1) walk(c);
    }
  })(p);
  const r = p.ownerDocument.createRange();
  if (target) r.setStart(target, off);
  else { r.selectNodeContents(p); r.collapse(false); }
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

/**
 * Bind an editor's contenteditable to a Yjs doc (spike scope).
 * @returns {{ destroy(): void }}
 */
export function bindParagraphSpike(editor, doc) {
  const blocks = doc.getArray('blocks');
  const content = editor.content;
  const getSel = () => content.ownerDocument.defaultView?.getSelection?.()
    || content.ownerDocument.getSelection?.();
  let applyingRemote = false;

  // ---- DOM -> Y (local edits) -------------------------------------------
  function reconcileFromDom() {
    const ps = childParagraphs(content);
    doc.transact(() => {
      while (blocks.length < ps.length) blocks.push([new Y.Text()]);
      while (blocks.length > ps.length) blocks.delete(blocks.length - 1, 1);
      ps.forEach((p, i) => reconcileText(blocks.get(i), serialize(p)));
    }, LOCAL);
  }
  const onInput = () => { if (!applyingRemote) reconcileFromDom(); };
  content.addEventListener('input', onInput);

  // ---- caret capture (must happen BEFORE a remote change integrates) -----
  // Snapshot the local caret as a Yjs RelativePosition at `beforeTransaction`,
  // while the Y.Text is still in its pre-update state, so it tracks through the
  // incoming remote edit. (Capturing after — in the observer — anchors to the
  // already-changed text and the caret drifts.)
  let caret = null;                            // { paraIndex, rel }
  function captureCaret() {
    if (applyingRemote) return;
    const sel = getSel();
    const ps = childParagraphs(content);
    for (let i = 0; i < ps.length && i < blocks.length; i++) {
      const ci = caretIndexInPara(ps[i], sel);
      if (ci >= 0) { caret = { paraIndex: i, rel: Y.createRelativePositionFromTypeIndex(blocks.get(i), ci) }; return; }
    }
    caret = null;
  }
  const onBeforeTxn = (txn) => { if (txn.origin !== LOCAL) captureCaret(); };
  doc.on('beforeTransaction', onBeforeTxn);

  // ---- Y -> DOM (remote edits) ------------------------------------------
  function renderFromModel() {
    const cap = caret;                         // captured pre-update by onBeforeTxn
    let ps = childParagraphs(content);
    while (ps.length < blocks.length) { const p = content.ownerDocument.createElement('p'); content.appendChild(p); ps.push(p); }
    while (ps.length > blocks.length) { content.removeChild(ps.pop()); }
    for (let i = 0; i < blocks.length; i++) render(ps[i], blocks.get(i).toDelta());
    // restore caret via the pre-update RelativePosition
    const sel = getSel();
    if (cap && cap.rel && sel) {
      const abs = Y.createAbsolutePositionFromRelativePosition(cap.rel, doc);
      const after = childParagraphs(content);
      const para = after[cap.paraIndex] || after[after.length - 1];
      if (abs && para) setCaretInPara(para, abs.index, sel);
    }
  }
  const observer = (_events, txn) => {
    if (txn.origin === LOCAL) return;          // ignore our own edits (no echo)
    applyingRemote = true;
    try { renderFromModel(); } finally { applyingRemote = false; }
  };
  blocks.observeDeep(observer);

  // ---- initial sync ------------------------------------------------------
  if (blocks.length === 0) reconcileFromDom();               // seed model from DOM
  else { applyingRemote = true; try { renderFromModel(); } finally { applyingRemote = false; } }

  return {
    destroy() {
      content.removeEventListener('input', onInput);
      blocks.unobserveDeep(observer);
      doc.off('beforeTransaction', onBeforeTxn);
    },
  };
}

// Exposed for unit tests of the pure transforms.
export const _internals = { serialize, render, reconcileText, sameAttrs, textOf };
