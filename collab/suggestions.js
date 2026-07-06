import * as Y from 'yjs';
import { uid } from '../src/utils/id.js';

// Bound the proposed text so a client can't push a multi-MB insert into the
// shared doc that then fans out to every peer. Hygiene, not a hard boundary.
const MAX_TEXT = 10_000;

/**
 * Suggestions / tracked changes (#15) — model + accept/reject.
 *
 * A tracked change is a text-formatting attribute `suggestion: { id, type, author }`
 * on a block's Y.Text:
 *   - insert: the proposed text is inserted, marked, and rendered (later) as an
 *     addition. Accept keeps it (drop the mark); reject removes the text.
 *   - delete: the text is NOT removed — the range is marked and (later) shown
 *     struck-through. Accept removes it; reject keeps it (drop the mark).
 *
 * Operating on the Y.Text directly keeps tracked changes conflict-free (they are
 * just marks) and reversible. NOTE (v1.1): suggestion-mode `beforeinput`
 * interception and the struck-through/colored DOM rendering through the binding
 * are not built yet — this is the model + resolution layer.
 */
export class SuggestionStore {
  constructor(doc) {
    this.doc = doc;
    this.blocks = doc.getArray('blocks');
  }

  /** Propose inserting `text` at `pos` in a block. */
  suggestInsert(blockId, pos, text, author, color = null) {
    const block = this._block(blockId);
    if (!block || !text) return null;
    if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
    const id = uid();
    block.get('text').insert(pos, text, { suggestion: { id, type: 'insert', author, ...(color ? { color } : {}) } });
    return id;
  }

  /** Propose deleting [from, to) in a block (marks it; text stays until accept). */
  suggestDelete(blockId, from, to, author, color = null) {
    const block = this._block(blockId);
    if (!block || to <= from) return null;
    const id = uid();
    block.get('text').format(from, to - from, { suggestion: { id, type: 'delete', author, ...(color ? { color } : {}) } });
    return id;
  }

  accept(id) {
    const hit = this._find(id);
    if (!hit) return;
    const yt = hit.block.get('text');
    if (hit.type === 'insert') yt.format(hit.from, hit.to - hit.from, { suggestion: null });   // keep text
    else yt.delete(hit.from, hit.to - hit.from);                                               // remove text
  }

  reject(id) {
    const hit = this._find(id);
    if (!hit) return;
    const yt = hit.block.get('text');
    if (hit.type === 'insert') yt.delete(hit.from, hit.to - hit.from);                         // remove text
    else yt.format(hit.from, hit.to - hit.from, { suggestion: null });                         // keep text
  }

  acceptAll() { this.list().forEach((s) => this.accept(s.id)); }
  rejectAll() { this.list().forEach((s) => this.reject(s.id)); }

  /** All open suggestions across blocks. */
  list() {
    const out = [];
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks.get(i);
      const blockId = block.get('id');
      let pos = 0;
      const seen = new Map();
      for (const op of block.get('text').toDelta()) {
        const s = op.attributes?.suggestion;
        if (s) {
          const r = seen.get(s.id) || { id: s.id, type: s.type, author: s.author, color: s.color || null, blockId, from: pos, to: pos };
          r.to = pos + op.insert.length;
          seen.set(s.id, r);
        }
        pos += op.insert.length;
      }
      out.push(...seen.values());
    }
    return out;
  }

  observe(cb) { this.blocks.observeDeep(cb); }
  unobserve(cb) { this.blocks.unobserveDeep(cb); }

  _block(id) {
    for (let i = 0; i < this.blocks.length; i++) if (this.blocks.get(i).get('id') === id) return this.blocks.get(i);
    return null;
  }
  _find(id) {
    const s = this.list().find((x) => x.id === id);
    return s ? { ...s, block: this._block(s.blockId) } : null;
  }
}
