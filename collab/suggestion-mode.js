import * as Y from 'yjs';
import { uid } from '../src/utils/id.js';
import { sanitize } from '../src/utils/html.js';
import { blockHostAt, modelForHost, textIndexInHost, flattenHosts, domPointInHost, _internals, LOCAL } from './paragraph-binding.js';

/**
 * Suggestion mode (#15) — intercept typing so edits become tracked changes.
 *
 * When enabled, `beforeinput` is intercepted:
 *  - insertText -> insert the text marked `suggestion:{insert}` (merged with an
 *    adjacent same-author insert so a typed run is one suggestion).
 *  - deleteContentBackward -> if deleting your own un-accepted insertion, remove
 *    it; otherwise MARK the char `suggestion:{delete}` (struck-through, kept
 *    until accepted) and move the caret left.
 *  - deleteContentForward -> the same for the character after the caret.
 *  - word and line deletes -> the same for the range the browser reports.
 *
 *  - insertReplacementText (spellcheck, autocorrect) -> old text marked deleted,
 *    new text inserted.
 *  - IME composition can't be cancelled, so the text is marked once it commits.
 *  - Any other input type that can change text is blocked rather than left untracked.
 *
 * Enter and Shift+Enter are not tracked: suggestions live on text, and the model
 * has no representation of a tracked block split. Commands (toolbar, slash menu,
 * editor.cmd) fire no input event, so they aren't tracked either.
 *
 * Selections (#19): typing over a selection marks it deleted + inserts the new
 * text; Delete/Backspace on a selection marks the range deleted. Single-block
 * selections only (cross-block range ops fall back to normal editing).
 *
 * The marks render + round-trip via the schema; accept/reject live in
 * SuggestionStore (collab/suggestions.js). Paste is handled below (#20).
 */
const RANGE_DELETES = new Set([
  'deleteWordBackward', 'deleteWordForward',
  'deleteSoftLineBackward', 'deleteSoftLineForward',
  'deleteHardLineBackward', 'deleteHardLineForward',
  'deleteEntireSoftLine',
]);

const TRACKED_INPUT = new Set(['insertText', 'deleteContentBackward', 'deleteContentForward']);
const UNTRACKED_INPUT = new Set([
  'insertParagraph', 'insertLineBreak',                                                    // see above
  'insertCompositionText', 'insertFromComposition', 'deleteCompositionText', 'deleteByComposition',
]);

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
    const block = modelForHost(blocks, b);
    if (!block || !block.get('text')) return null;        // atomic block — not editable here
    const idx = textIndexInHost(b.host, r.startContainer, r.startOffset);
    return idx < 0 ? null : { block, id: block.get('id'), index: idx };
  }

  // Re-render a single block's text from the model. Suggestion-mode tags its
  // mutations LOCAL so the paragraph binding skips its (full-document) remote
  // re-render path; we repaint just the affected block here instead.
  function renderBlock(block) {
    const id = block.get('id');
    const h = flattenHosts(content).find((x) => x.el.getAttribute('data-id') === id);
    if (h) _internals.renderInline(h.host, block.get('text').toDelta(), { literalNewlines: h.host.tagName === 'PRE' });
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

  // A DOM range within a single block -> { block, id, from, to }, or null.
  function modelRange(r) {
    if (!content.contains(r.startContainer) || !content.contains(r.endContainer)) return null;
    const b1 = blockHostAt(content, r.startContainer);
    const b2 = blockHostAt(content, r.endContainer);
    if (!b1 || !b2 || b1.index !== b2.index) return null;   // single block only (v1)
    const block = modelForHost(blocks, b1);
    if (!block || !block.get('text')) return null;
    const a = textIndexInHost(b1.host, r.startContainer, r.startOffset);
    const z = textIndexInHost(b1.host, r.endContainer, r.endOffset);
    if (a < 0 || z < 0 || a === z) return null;
    return { block, id: block.get('id'), from: Math.min(a, z), to: Math.max(a, z) };
  }

  function selectionRange() {
    const sel = getSel();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    return modelRange(sel.getRangeAt(0));
  }

  // Word and line deletes: remove your own pending insertions in the range and
  // mark everything else deleted, as Backspace does one character at a time.
  function trackDeletion({ block, id, from, to }, forward) {
    const yt = block.get('text');
    const adjacent = [from > 0 ? sugAt(yt, from - 1) : null, sugAt(yt, to)]
      .find((s) => s && s.type === 'delete' && s.author === author);
    const sug = adjacent || { id: uid(), type: 'delete', author, ...(color ? { color } : {}) };
    const runs = [];
    let at = 0;
    for (const op of yt.toDelta()) {
      const end = at + op.insert.length;
      const a = Math.max(at, from), z = Math.min(end, to);
      if (a < z) runs.push({ a, z, s: op.attributes?.suggestion });
      at = end;
    }
    let removed = 0;
    doc.transact(() => {
      for (const { a, z, s } of runs.reverse()) {           // back to front, so offsets stay valid
        if (s && s.type === 'insert' && s.author === author) { yt.delete(a, z - a); removed += z - a; }
        else yt.format(a, z - a, { suggestion: sug });
      }
    }, LOCAL);
    renderBlock(block);
    setCaret(id, forward ? to - removed : from);
  }

  const onBeforeInput = (e) => {
    if (!isEnabled()) return;

    if (e.inputType === 'insertReplacementText') {
      e.preventDefault();                                   // blocked unless it can be tracked
      const target = e.getTargetRanges?.()[0];
      const range = target ? modelRange(target) : selectionRange();
      const text = e.data ?? e.dataTransfer?.getData('text/plain');
      if (!range || !text) return;
      const yt = range.block.get('text');
      doc.transact(() => {
        yt.format(range.from, range.to - range.from, { suggestion: { id: uid(), type: 'delete', author, ...(color ? { color } : {}) } });
        yt.insert(range.to, text, { suggestion: { id: uid(), type: 'insert', author, ...(color ? { color } : {}) } });
      }, LOCAL);
      renderBlock(range.block);
      setCaret(range.id, range.to + text.length);
      return;
    }

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

    if (RANGE_DELETES.has(e.inputType)) {
      // Blocked unless it can be tracked: a range crossing blocks would merge them.
      e.preventDefault();
      const target = e.getTargetRanges?.()[0];
      const range = target && modelRange(target);
      if (range) trackDeletion(range, e.inputType.endsWith('Forward'));
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
    } else if (e.inputType === 'deleteContentForward') {
      const pos = caretPos();
      if (!pos) return;
      e.preventDefault();                                   // also stops a native merge at the block's end
      const yt = pos.block.get('text');
      if (pos.index >= yt.length) return;
      const right = sugAt(yt, pos.index);
      const own = right && right.type === 'insert' && right.author === author;
      doc.transact(() => {
        if (own) {
          yt.delete(pos.index, 1);                          // un-type your own pending insertion
        } else {
          const left = pos.index > 0 ? sugAt(yt, pos.index - 1) : null;   // merge with an adjacent delete run
          const sug = (left && left.type === 'delete' && left.author === author) ? left : { id: uid(), type: 'delete', author, ...(color ? { color } : {}) };
          yt.format(pos.index, 1, { suggestion: sug });     // mark, don't remove
        }
      }, LOCAL);
      renderBlock(pos.block);
      setCaret(pos.id, own ? pos.index : pos.index + 1);
    } else if (/^(insert|delete)/.test(e.inputType) && !TRACKED_INPUT.has(e.inputType) && !UNTRACKED_INPUT.has(e.inputType)) {
      e.preventDefault();                                   // so a new or missed path can't skip review
    }
  };

  // ── IME ──────────────────────────────────────────────────────
  let composition = null;      // { id, start: RelativePosition } of the running composition

  const onCompositionStart = () => {
    composition = null;
    if (!isEnabled() || editor._disabled) return;
    // Composing over a selection would delete it untracked, so mark it and compose after it.
    const rng = selectionRange();
    if (rng) {
      doc.transact(() => rng.block.get('text').format(rng.from, rng.to - rng.from, {
        suggestion: { id: uid(), type: 'delete', author, ...(color ? { color } : {}) },
      }), LOCAL);
      renderBlock(rng.block);
      setCaret(rng.id, rng.to);
    }
    const pos = caretPos();
    if (!pos) return;
    // Left-associated, so a peer's edit in front of the composition moves it along.
    composition = { id: pos.id, start: Y.createRelativePositionFromTypeIndex(pos.block.get('text'), pos.index, -1) };
  };

  const onCompositionCommit = ({ data }) => {
    const c = composition;
    composition = null;
    if (!c || !data || !isEnabled()) return;
    let block = null;
    for (const m of blocks) if (m.get('id') === c.id) block = m;
    const yt = block?.get('text');
    if (!yt) return;
    const text = yt.toString();
    const at = Y.createAbsolutePositionFromRelativePosition(c.start, doc)?.index ?? 0;
    const start = text.startsWith(data, at) ? at : text.indexOf(data);
    if (start < 0) return;
    const prev = start > 0 ? sugAt(yt, start - 1) : null;
    const sug = (prev && prev.type === 'insert' && prev.author === author) ? prev : { id: uid(), type: 'insert', author, ...(color ? { color } : {}) };
    doc.transact(() => yt.format(start, data.length, { suggestion: sug }), LOCAL);
    renderBlock(block);
    setCaret(c.id, start + data.length);
  };

  // Paste (#20): intercept in the CAPTURE phase so we run before the editor's
  // own (bubble-phase) paste handler, then take over and record the pasted
  // content as a tracked insertion. Inline marks are preserved; block structure
  // is flattened into the current block (multi-block paste is future work).
  const onPaste = (e) => {
    if (!isEnabled() || editor._disabled) return;
    const rng = selectionRange();                 // pasting over a selection replaces it
    const pos = rng ? { block: rng.block, id: rng.id, index: rng.to } : caretPos();
    if (!pos) return;
    e.preventDefault();
    e.stopImmediatePropagation();                 // skip the editor's direct-insert paste handler
    if (e.clipboardData) insertTransferred(e.clipboardData, pos, rng);
  };

  // Drop: as paste, at the drop point. A drag within the editor is a move, which the
  // model can't track, so it is blocked. Files are still reported.
  const onDrop = (e) => {
    if (!isEnabled() || editor._disabled) return;
    e.preventDefault();
    e.stopImmediatePropagation();                 // skip the editor's direct-insert drop handler
    const dt = e.dataTransfer;
    const internal = !!dt?.getData('application/x-rune-drag');
    if (dt && !internal && (dt.getData('text/html') || dt.getData('text/plain'))) {
      editor._placeCaretAtPoint(e.clientX, e.clientY);
      const rng = selectionRange();
      const pos = rng ? { block: rng.block, id: rng.id, index: rng.to } : caretPos();
      if (pos) insertTransferred(dt, pos, rng);
    }
    editor.events.emit('drop', { editor, files: [...(dt?.files || [])] });
  };

  function insertTransferred(dt, pos, rng) {
    const yt = pos.block.get('text');
    const sug = { id: uid(), type: 'insert', author, ...(color ? { color } : {}) };
    const htmlData = dt.getData('text/html');
    if (rng && (htmlData || dt.getData('text/plain'))) {
      doc.transact(() => yt.format(rng.from, rng.to - rng.from, {
        suggestion: { id: uid(), type: 'delete', author, ...(color ? { color } : {}) },
      }), LOCAL);
    }
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
  }

  content.addEventListener('beforeinput', onBeforeInput);
  content.addEventListener('paste', onPaste, true);
  content.addEventListener('drop', onDrop, true);
  content.addEventListener('compositionstart', onCompositionStart);
  editor.events.on('collab:compositioncommit', onCompositionCommit);
  let _destroyed = false;
  const api = {
    destroy() {
      if (_destroyed) return;
      _destroyed = true;
      content.removeEventListener('beforeinput', onBeforeInput);
      content.removeEventListener('paste', onPaste, true);
      content.removeEventListener('drop', onDrop, true);
      content.removeEventListener('compositionstart', onCompositionStart);
      editor.events.off('collab:compositioncommit', onCompositionCommit);
    },
  };
  editor.events.on('destroy', api.destroy);
  return api;
}
