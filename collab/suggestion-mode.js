import { uid } from '../src/utils/id.js';
import { sanitize } from '../src/utils/html.js';
import { blockHostAt, textIndexInHost, flattenHosts, domPointInHost, _internals, LOCAL } from './paragraph-binding.js';

/**
 * Suggestion mode (#15) — intercept typing so edits become tracked changes.
 *
 * When enabled, `beforeinput` is intercepted:
 *  - insertText -> insert the text marked `suggestion:{insert}` (merged with an
 *    adjacent same-author insert so a typed run is one suggestion).
 *  - deleteContentBackward -> if deleting your own un-accepted insertion, remove
 *    it; otherwise MARK the char `suggestion:{delete}` (struck-through, kept
 *    until accepted) and move the caret left.
 *
 * Selections (#19): typing over a selection marks it deleted + inserts the new
 * text; Delete/Backspace on a selection marks the range deleted. Single-block
 * selections only (cross-block range ops fall back to normal editing).
 *
 * The marks render + round-trip via the schema; accept/reject live in
 * SuggestionStore (collab/suggestions.js). Paste is handled below (#20).
 */
export function bindSuggestionMode(editor, doc, { author = 'Anon', color = null, isEnabled = () => false } = {}) {
  const content = editor.content;
  const cdoc = content.ownerDocument;
  const blocks = doc.getArray('blocks');
  const getSel = () => cdoc.defaultView?.getSelection?.() || cdoc.getSelection?.();

  const sugAt = (yt, i) => {
    let p = 0;
    for (const op of yt.toDelta()) { if (i >= p && i < p + op.insert.length) return op.attributes?.suggestion || null; p += op.insert.length; }
    return null;
  };

  function caretPos() {
    const sel = getSel();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    const b = content.contains(r.startContainer) ? blockHostAt(content, r.startContainer) : null;
    if (!b || b.index >= blocks.length) return null;
    const block = blocks.get(b.index);
    if (!block.get('text')) return null;                  // atomic block — not editable here
    const idx = textIndexInHost(b.host, r.startContainer, r.startOffset);
    return idx < 0 ? null : { block, id: block.get('id'), index: idx };
  }

  // Re-render a single block's text from the model. Suggestion-mode tags its
  // mutations LOCAL so the paragraph binding skips its (full-document) remote
  // re-render path; we repaint just the affected block here instead.
  function renderBlock(block) {
    const id = block.get('id');
    const h = flattenHosts(content).find((x) => x.el.getAttribute('data-id') === id);
    if (h) _internals.renderInline(h.host, block.get('text').toDelta());
  }

  function setCaret(id, index) {
    const host = flattenHosts(content).find((h) => h.el.getAttribute('data-id') === id)?.host;
    if (!host) return;
    const pt = domPointInHost(host, index);
    const r = cdoc.createRange();
    if (pt) r.setStart(pt.node, pt.off); else { r.selectNodeContents(host); r.collapse(false); }
    r.collapse(true);
    const sel = getSel(); sel.removeAllRanges(); sel.addRange(r);
  }

  // A non-collapsed selection within a single block -> { block, id, from, to }.
  function selectionRange() {
    const sel = getSel();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    if (!content.contains(r.startContainer) || !content.contains(r.endContainer)) return null;
    const b1 = blockHostAt(content, r.startContainer);
    const b2 = blockHostAt(content, r.endContainer);
    if (!b1 || !b2 || b1.index !== b2.index || b1.index >= blocks.length) return null;   // single block only (v1)
    const block = blocks.get(b1.index);
    if (!block.get('text')) return null;
    const a = textIndexInHost(b1.host, r.startContainer, r.startOffset);
    const z = textIndexInHost(b1.host, r.endContainer, r.endOffset);
    if (a < 0 || z < 0 || a === z) return null;
    return { block, id: block.get('id'), from: Math.min(a, z), to: Math.max(a, z) };
  }

  const onBeforeInput = (e) => {
    if (!isEnabled()) return;

    // Range operations (#19): a non-collapsed selection + type/delete.
    const rng = selectionRange();
    if (rng && (e.inputType === 'insertText' || e.inputType.startsWith('delete'))) {
      e.preventDefault();
      const yt = rng.block.get('text');
      const adding = e.inputType === 'insertText' && e.data;
      doc.transact(() => {
        yt.format(rng.from, rng.to - rng.from, { suggestion: { id: uid(), type: 'delete', author, ...(color ? { color } : {}) } });
        if (adding) yt.insert(rng.to, e.data, { suggestion: { id: uid(), type: 'insert', author, ...(color ? { color } : {}) } });
      }, LOCAL);
      renderBlock(rng.block);
      setCaret(rng.id, adding ? rng.to + e.data.length : rng.from);   // replace: caret after new text; delete: caret at start
      return;
    }

    if (e.inputType === 'insertText' && e.data) {
      const pos = caretPos();
      if (!pos) return;
      e.preventDefault();
      const yt = pos.block.get('text');
      const prev = pos.index > 0 ? sugAt(yt, pos.index - 1) : null;
      const sug = (prev && prev.type === 'insert' && prev.author === author) ? prev : { id: uid(), type: 'insert', author, ...(color ? { color } : {}) };
      doc.transact(() => yt.insert(pos.index, e.data, { suggestion: sug }), LOCAL);
      renderBlock(pos.block);
      setCaret(pos.id, pos.index + e.data.length);          // place caret after the typed text
    } else if (e.inputType === 'deleteContentBackward') {
      const pos = caretPos();
      if (!pos || pos.index === 0) { if (pos) e.preventDefault(); return; }
      e.preventDefault();
      const yt = pos.block.get('text');
      const left = sugAt(yt, pos.index - 1);
      doc.transact(() => {
        if (left && left.type === 'insert' && left.author === author) {
          yt.delete(pos.index - 1, 1);                      // un-type your own pending insertion
        } else {
          const right = sugAt(yt, pos.index);               // merge with an adjacent delete run
          const sug = (right && right.type === 'delete' && right.author === author) ? right : { id: uid(), type: 'delete', author, ...(color ? { color } : {}) };
          yt.format(pos.index - 1, 1, { suggestion: sug }); // mark, don't remove
        }
      }, LOCAL);
      renderBlock(pos.block);
      setCaret(pos.id, pos.index - 1);
    }
  };

  // Paste (#20): intercept in the CAPTURE phase so we run before the editor's
  // own (bubble-phase) paste handler, then take over and record the pasted
  // content as a tracked insertion. Inline marks are preserved; block structure
  // is flattened into the current block (multi-block paste is future work).
  const onPaste = (e) => {
    if (!isEnabled()) return;
    const pos = caretPos();
    if (!pos) return;
    e.preventDefault();
    e.stopImmediatePropagation();                 // skip the editor's direct-insert paste handler
    const dt = e.clipboardData;
    if (!dt) return;
    const yt = pos.block.get('text');
    const sug = { id: uid(), type: 'insert', author, ...(color ? { color } : {}) };
    const htmlData = dt.getData('text/html');
    let at = pos.index;
    if (htmlData) {
      const tmp = cdoc.createElement('div');
      tmp.innerHTML = sanitize(htmlData);          // strict paste sanitizer (untrusted clipboard)
      const delta = _internals.serializeInline(tmp);
      doc.transact(() => {
        for (const op of delta) { yt.insert(at, op.insert, { ...(op.attributes || {}), suggestion: sug }); at += op.insert.length; }
      }, LOCAL);
    } else {
      const text = dt.getData('text/plain');
      if (text) { doc.transact(() => yt.insert(at, text, { suggestion: sug }), LOCAL); at += text.length; }
    }
    renderBlock(pos.block);
    setCaret(pos.id, at);
  };

  content.addEventListener('beforeinput', onBeforeInput);
  content.addEventListener('paste', onPaste, true);
  let _destroyed = false;
  const api = {
    destroy() {
      if (_destroyed) return;
      _destroyed = true;
      content.removeEventListener('beforeinput', onBeforeInput);
      content.removeEventListener('paste', onPaste, true);
    },
  };
  editor.events.on('destroy', api.destroy);
  return api;
}
