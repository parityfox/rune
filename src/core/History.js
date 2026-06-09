// Strip base64 data URIs from snapshots to save memory.
// A placeholder is stored instead; on undo/redo the images will show
// as broken until the next edit re-triggers the upload hook.
const DATA_URI_RE = /\ssrc="data:[^"]{256,}"/g;
const DATA_URI_PLACEHOLDER = ' src=""';

// Caret as an absolute text offset within the content root, so it survives the
// innerHTML rebuild on undo/redo (returns null when there's no caret in content).
function _captureCaret(content) {
  const doc = content.ownerDocument;
  const sel = doc.defaultView?.getSelection?.();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!content.contains(r.startContainer)) return null;
  let offset = 0;
  const walker = doc.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node === r.startContainer) return offset + r.startOffset;
    offset += node.textContent.length;
  }
  return offset;
}

function _restoreCaret(content, offset) {
  if (offset == null) return;
  const doc = content.ownerDocument;
  const sel = doc.defaultView?.getSelection?.();
  if (!sel) return;
  const walker = doc.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let node, acc = 0, target = null, targetOff = 0;
  while ((node = walker.nextNode())) {
    const len = node.textContent.length;
    if (acc + len >= offset) { target = node; targetOff = offset - acc; break; }
    acc += len;
  }
  const r = doc.createRange();
  if (target) r.setStart(target, Math.min(targetOff, target.textContent.length));
  else { r.selectNodeContents(content); r.collapse(false); }
  r.collapse(true);
  try { sel.removeAllRanges(); sel.addRange(r); } catch { /* detached */ }
}

/**
 * EditorHistory — the contract `Editor` depends on for undo/redo. Lets the
 * snapshot history below be swapped for an alternative (e.g. a Yjs UndoManager
 * adapter for collaborative editing) via `editor.replaceHistory()`.
 *
 * @typedef {Object} EditorHistory
 * @property {() => void}    save     Record a boundary (may be debounced); no-op for CRDT-backed histories.
 * @property {() => void}    saveNow  Record immediately / set an explicit undo boundary.
 * @property {() => boolean} undo
 * @property {() => boolean} redo
 * @property {() => void}    [destroy] Release timers/resources.
 */

/**
 * History — undo/redo stack. Implements {@link EditorHistory}.
 *
 * Stores innerHTML snapshots. Debounced so rapid keystrokes
 * don't flood the stack. Memory is capped by both entry count
 * and total byte size to prevent base64-heavy docs from bloating.
 */
export class History {
  constructor(editor, { maxSize = 100, maxBytes = 10 * 1024 * 1024, debounce = 300 } = {}) {
    this.editor = editor;
    this.maxSize = maxSize;
    this._maxBytes = maxBytes;
    this._totalBytes = 0;
    this._stack = [];
    this._carets = [];      // caret offset per snapshot (parallel to _stack)
    this._index = -1;
    this._timer = null;
    this._debounce = debounce;
  }

  /** Save a snapshot (debounced). */
  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._push(), this._debounce);
  }

  /** Save immediately (e.g. before a programmatic change). */
  saveNow() {
    clearTimeout(this._timer);
    this._push();
  }

  _push() {
    const raw = this.editor.content.innerHTML;

    // Strip large base64 data URIs to save memory
    const html = raw.replace(DATA_URI_RE, DATA_URI_PLACEHOLDER);

    const current = this._stack[this._index];
    if (current === html) return;

    const caret = _captureCaret(this.editor.content);

    // Drop any redo states and recalculate byte total
    const kept = this._stack.slice(0, this._index + 1);
    this._totalBytes = kept.reduce((sum, s) => sum + s.length, 0);
    this._stack = kept;
    this._carets = this._carets.slice(0, this._index + 1);

    this._stack.push(html);
    this._carets.push(caret);
    this._totalBytes += html.length;
    this._index = this._stack.length - 1;

    // Evict oldest entries if over count or byte limit
    while (this._stack.length > 1 &&
           (this._stack.length > this.maxSize || this._totalBytes > this._maxBytes)) {
      this._totalBytes -= this._stack.shift().length;
      this._carets.shift();
      this._index--;
    }
  }

  undo() {
    // Flush the live document into the stack before stepping back. Commands
    // snapshot their PRE-mutation state (a coalescing boundary) and never push
    // the result; typing pushes on a debounce. Either way the latest state may
    // not be on the stack yet when undo is invoked, which would make undo skip
    // it (or no-op on the very first command). _push() de-dupes, so this is
    // free when the current state is already recorded.
    this._captureCurrent();
    if (this._index <= 0) return false;
    this._index--;
    this._apply(this._stack[this._index]);
    return true;
  }

  redo() {
    if (this._index >= this._stack.length - 1) return false;
    this._index++;
    this._apply(this._stack[this._index]);
    return true;
  }

  /** Commit any unsaved live state to the stack (cancels a pending debounce). */
  _captureCurrent() {
    clearTimeout(this._timer);
    this._push();
  }

  _apply(html) {
    this.editor.content.innerHTML = html;
    this.editor._ensureContent();
    _restoreCaret(this.editor.content, this._carets[this._index]);
    // Route through _notifyChange so undo/redo also fire the onChange callback,
    // not just the internal 'change' event — otherwise framework bindings that
    // mirror editor state desync after every undo.
    this.editor._notifyChange();
  }

  get canUndo() { return this._index > 0; }
  get canRedo() { return this._index < this._stack.length - 1; }

  /** Release the debounce timer and drop the snapshot stack. */
  destroy() {
    clearTimeout(this._timer);
    this._stack = [];
    this._carets = [];
    this._index = -1;
    this._totalBytes = 0;
  }
}
