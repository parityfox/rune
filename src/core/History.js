/**
 * History — undo/redo stack.
 *
 * Stores innerHTML snapshots. Debounced so rapid keystrokes
 * don't flood the stack.
 */
export class History {
  constructor(editor, { maxSize = 100, debounce = 300 } = {}) {
    this.editor = editor;
    this.maxSize = maxSize;
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
    const html = this.editor.content.innerHTML;
    const current = this._stack[this._index];
    if (current === html) return;

    // Drop any redo states
    this._stack = this._stack.slice(0, this._index + 1);
    this._stack.push(html);

    if (this._stack.length > this.maxSize) {
      this._stack.shift();
    } else {
      this._index++;
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
    this.editor.events.emit('change', this.editor);
    this.editor._ensureContent();
  }

  get canUndo() { return this._index > 0; }
  get canRedo() { return this._index < this._stack.length - 1; }
}
