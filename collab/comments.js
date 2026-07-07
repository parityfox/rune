import * as Y from 'yjs';
import { uid } from '../src/utils/id.js';

// Bound stored strings so a client can't push a multi-MB author/comment into the
// shared doc that then fans out to every peer. Hygiene, not a hard boundary — a
// hostile peer can still craft raw Yjs updates over the wire.
const MAX_AUTHOR = 256;
const MAX_TEXT = 10_000;
const _clip = (s, n) => (typeof s === 'string' && s.length > n ? s.slice(0, n) : s);

/**
 * Comments (#14) — threaded comments anchored to a text range within a block.
 *
 * Threads live in `doc.getArray('comments')` (a Y.Array of Y.Map), separate
 * from the block text. Each thread anchors to its block's Y.Text via Yjs
 * RelativePositions, so it follows the text as the document is edited
 * concurrently. If the anchored text is deleted the range collapses and the
 * thread is reported as `orphaned` rather than rendering a zero-width highlight.
 *
 * Author names + comment text are untrusted — render them via textContent only.
 */
export class CommentStore {
  constructor(doc) {
    this.doc = doc;
    this.threads = doc.getArray('comments');
    this.blocks = doc.getArray('blocks');
  }

  /** Create a thread anchored to [from, to) within block `blockId`. */
  add({ blockId, from, to, text, author, id = uid(), ts = Date.now() }) {
    const block = this._blockById(blockId);
    if (!block || to <= from) return null;
    author = _clip(author, MAX_AUTHOR);
    text = _clip(text, MAX_TEXT);
    const yt = block.get('text');
    const m = new Y.Map();
    m.set('id', id);
    m.set('blockId', blockId);
    m.set('from', Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(yt, from)));
    m.set('to', Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(yt, to)));
    m.set('resolved', false);
    m.set('author', author);
    m.set('ts', ts);
    const replies = new Y.Array();
    if (text) replies.push([{ id: uid(), author, text, ts }]);
    m.set('replies', replies);
    this.threads.push([m]);
    return id;
  }

  reply(threadId, { author, text, ts = Date.now() }) {
    const m = this._threadById(threadId);
    if (m && text) m.get('replies').push([{ id: uid(), author: _clip(author, MAX_AUTHOR), text: _clip(text, MAX_TEXT), ts }]);
  }

  resolve(threadId, resolved = true) {
    const m = this._threadById(threadId);
    if (m) m.set('resolved', resolved);
  }

  remove(threadId) {
    for (let i = 0; i < this.threads.length; i++) {
      if (this.threads.get(i).get('id') === threadId) { this.threads.delete(i, 1); return; }
    }
  }

  /** Resolve all threads to absolute positions; flags orphans. */
  list() {
    const out = [];
    this.threads.forEach((m) => {
      // Every thread field is peer-controlled (raw Yjs updates), so one
      // malformed thread must not throw and take list() down for every peer.
      if (!(m instanceof Y.Map)) return;
      let from, to;
      try {
        from = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(m.get('from')), this.doc);
        to = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(m.get('to')), this.doc);
      } catch {
        return; // unreadable anchor — skip the thread
      }
      const replies = m.get('replies');
      const orphaned = !from || !to || to.index <= from.index;
      out.push({
        id: m.get('id'),
        blockId: m.get('blockId'),
        from: from ? from.index : null,
        to: to ? to.index : null,
        resolved: !!m.get('resolved'),
        author: m.get('author'),
        ts: m.get('ts'),
        replies: replies instanceof Y.Array ? replies.toArray() : [],
        orphaned,
      });
    });
    return out;
  }

  observe(cb) { this.threads.observeDeep(cb); this.blocks.observeDeep(cb); }
  unobserve(cb) { this.threads.unobserveDeep(cb); this.blocks.unobserveDeep(cb); }

  _blockById(id) {
    for (let i = 0; i < this.blocks.length; i++) if (this.blocks.get(i).get('id') === id) return this.blocks.get(i);
    return null;
  }
  _threadById(id) {
    for (let i = 0; i < this.threads.length; i++) if (this.threads.get(i).get('id') === id) return this.threads.get(i);
    return null;
  }
}
