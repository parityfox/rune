import { uid } from '../src/utils/id.js';
import { blockHostAt, textIndexInHost, flattenHosts, domPointInHost } from './paragraph-binding.js';

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
export function bindSuggestionMode(editor, doc, { author = 'Anon', isEnabled = () => false } = {}) {
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
      const sug = (prev && prev.type === 'insert' && prev.author === author) ? prev : { id: uid(), type: 'insert', author };
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
        const sug = (right && right.type === 'delete' && right.author === author) ? right : { id: uid(), type: 'delete', author };
        yt.format(pos.index - 1, 1, { suggestion: sug });   // mark, don't remove
      }
      setCaret(pos.id, pos.index - 1);
    }
  };

  content.addEventListener('beforeinput', onBeforeInput);
  return { destroy() { content.removeEventListener('beforeinput', onBeforeInput); } };
}
