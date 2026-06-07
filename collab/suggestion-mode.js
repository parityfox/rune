import { uid } from '../src/utils/id.js';
import { sanitize } from '../src/utils/html.js';
import { blockHostAt, textIndexInHost, flattenHosts, domPointInHost, _internals } from './paragraph-binding.js';

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
 * The marks render + round-trip via the schema; accept/reject live in
 * SuggestionStore (collab/suggestions.js). v1 scope: collapsed-caret insert and
 * backspace (range operations + paste in suggest mode are future work).
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

  function setCaret(id, index) {
    const host = flattenHosts(content).find((h) => h.host.getAttribute('data-id') === id)?.host;
    if (!host) return;
    const pt = domPointInHost(host, index);
    const r = cdoc.createRange();
    if (pt) r.setStart(pt.node, pt.off); else { r.selectNodeContents(host); r.collapse(false); }
    r.collapse(true);
    const sel = getSel(); sel.removeAllRanges(); sel.addRange(r);
  }

  const onBeforeInput = (e) => {
    if (!isEnabled()) return;

    if (e.inputType === 'insertText' && e.data) {
      const pos = caretPos();
      if (!pos) return;
      e.preventDefault();
      const yt = pos.block.get('text');
      const prev = pos.index > 0 ? sugAt(yt, pos.index - 1) : null;
      const sug = (prev && prev.type === 'insert' && prev.author === author) ? prev : { id: uid(), type: 'insert', author, ...(color ? { color } : {}) };
      yt.insert(pos.index, e.data, { suggestion: sug });   // binding re-renders this block
      setCaret(pos.id, pos.index + e.data.length);          // place caret after the typed text
    } else if (e.inputType === 'deleteContentBackward') {
      const pos = caretPos();
      if (!pos || pos.index === 0) { if (pos) e.preventDefault(); return; }
      e.preventDefault();
      const yt = pos.block.get('text');
      const left = sugAt(yt, pos.index - 1);
      if (left && left.type === 'insert' && left.author === author) {
        yt.delete(pos.index - 1, 1);                        // un-type your own pending insertion
      } else {
        const right = sugAt(yt, pos.index);                 // merge with an adjacent delete run
        const sug = (right && right.type === 'delete' && right.author === author) ? right : { id: uid(), type: 'delete', author, ...(color ? { color } : {}) };
        yt.format(pos.index - 1, 1, { suggestion: sug });   // mark, don't remove
      }
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
      });
    } else {
      const text = dt.getData('text/plain');
      if (text) { yt.insert(at, text, { suggestion: sug }); at += text.length; }
    }
    setCaret(pos.id, at);
  };

  content.addEventListener('beforeinput', onBeforeInput);
  content.addEventListener('paste', onPaste, true);
  return {
    destroy() {
      content.removeEventListener('beforeinput', onBeforeInput);
      content.removeEventListener('paste', onPaste, true);
    },
  };
}
