// Strip base64 data URIs from snapshots to save memory.
// A placeholder is stored instead; on undo/redo the images will show
// as broken until the next edit re-triggers the upload hook.
const DATA_URI_RE = /\ssrc="data:[^"]{256,}"/g;
const DATA_URI_PLACEHOLDER = ' src=""';

/**
 * History — undo/redo stack.
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
    this._index = -1;
    this._timer = null;
    this._debounce = debounce;
    this._ignoreNext = false;
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

    // Drop any redo states and recalculate byte total
    const kept = this._stack.slice(0, this._index + 1);
    this._totalBytes = kept.reduce((sum, s) => sum + s.length, 0);
    this._stack = kept;

    this._stack.push(html);
    this._totalBytes += html.length;
    this._index = this._stack.length - 1;

    // Evict oldest entries if over count or byte limit
    while (this._stack.length > 1 &&
           (this._stack.length > this.maxSize || this._totalBytes > this._maxBytes)) {
      this._totalBytes -= this._stack.shift().length;
      this._index--;
    }
  }

  undo() {
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

  _apply(html) {
    this._ignoreNext = true;
    this.editor.content.innerHTML = html;
    this.editor.events.emit('change', { editor: this.editor, html });
    this.editor._ensureContent();
  }

  get canUndo() { return this._index > 0; }
  get canRedo() { return this._index < this._stack.length - 1; }
}
