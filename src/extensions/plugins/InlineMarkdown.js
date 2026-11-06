/**
 * InlineMarkdown — wrap inline markdown syntax in the matching mark as you type:
 *   **bold**   *italic*   `code`   ~~strike~~
 * Built on the input-rule engine; one Ctrl+Z restores the literal markers.
 */
// The mark each editor just created, until the next input decides what follows it.
const _justClosed = new WeakMap();

function wrap(tag) {
  return ({ editor, match, range }) => {
    range.deleteContents();
    const el = document.createElement(tag);
    el.textContent = match[1];
    range.insertNode(el);
    // Caret just after the new mark, in the parent. Chrome still treats that position
    // as inside the mark for typing, so init() below handles the next input.
    _justClosed.set(editor, el);
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStartAfter(el);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  };
}

function caretRightAfter(el) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return false;
  const caret = sel.getRangeAt(0);
  if (!el.parentNode.contains(caret.startContainer)) return false;
  const after = document.createRange();
  after.setStartAfter(el);
  after.collapse(true);
  const between = document.createRange();
  if (caret.compareBoundaryPoints(Range.START_TO_START, after) <= 0) {
    between.setStart(caret.startContainer, caret.startOffset);
    between.setEnd(after.startContainer, after.startOffset);
  } else {
    between.setStart(after.startContainer, after.startOffset);
    between.setEnd(caret.startContainer, caret.startOffset);
  }
  return between.toString() === '';
}

// Type the first character outside the mark. The rest of the run follows it natively.
function typeAfter(el, data, editor) {
  // Converting can leave an empty text node behind, which doesn't count as following text.
  while (el.nextSibling?.nodeType === Node.TEXT_NODE && !el.nextSibling.data) el.nextSibling.remove();
  const next = el.nextSibling;
  let node, offset;
  if (next?.nodeType === Node.TEXT_NODE) {
    next.insertData(0, data);
    node = next;
    offset = data.length;
  } else {
    // A trailing plain space would collapse, and the caret wouldn't appear to move.
    const text = data === ' ' && !next ? '\u00A0' : data;
    node = document.createTextNode(text);
    el.after(node);
    offset = text.length;
    if (text !== data) {
      // Once text follows it the space no longer collapses, so make it a normal one.
      // In the capture phase, so the editor's change event already sees the result.
      editor.content.addEventListener('input', () => {
        if (node.isConnected && node.length > 1 && node.data[0] === '\u00A0') node.replaceData(0, 1, ' ');
      }, { capture: true, once: true });
    }
  }
  const r = document.createRange();
  r.setStart(node, offset);
  r.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  editor.history.save();
  editor._notifyChange();
}

// Enter copies the mark into the new block as Chrome's typing style. Clear it there.
function clearCarriedMark(editor) {
  const block = editor.selection.getBlock();
  if (!block || block.textContent !== '' || !block.querySelector('strong, em, s, code')) return;
  block.innerHTML = '<br>';
  editor.selection.setAtStart(block);
  editor._notifyChange();
}

export const InlineMarkdown = {
  name: 'inlineMarkdown',
  type: 'plugin',

  init(editor) {
    editor.listen(editor.content, 'beforeinput', (e) => {
      const el = _justClosed.get(editor);
      if (!el) return;
      _justClosed.delete(editor);            // only the very next input
      if (e.defaultPrevented || !el.isConnected || !caretRightAfter(el)) return;
      if (e.inputType === 'insertText' && e.data) {
        e.preventDefault();
        typeAfter(el, e.data, editor);
      } else if (e.inputType === 'insertParagraph') {
        editor.content.addEventListener('input', () => clearCarriedMark(editor), { once: true });
      }
    });
  },

  inputRules: [
    { find: /\*\*([^*\n]+)\*\*$/,      handler: wrap('strong') },
    { find: /~~([^~\n]+)~~$/,          handler: wrap('s') },
    { find: /`([^`\n]+)`$/,            handler: wrap('code') },
    // single * italic — not preceded by another * (so it never fires inside **)
    { find: /(?<!\*)\*([^*\n]+)\*$/,   handler: wrap('em') },
    { find: /(?<!_)_([^_\n]+)_$/,      handler: wrap('em') },
  ],
};
