import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { MemoryHub } from '../collab/memory-hub.js';
import { CommentStore } from '../collab/comments.js';

// #14: threaded comments anchored by RelativePosition, synced off the doc.

function seedBlock(doc, id, text) {
  const m = new Y.Map();
  m.set('id', id); m.set('type', 'p');
  const t = new Y.Text(); t.insert(0, text); m.set('text', t);
  doc.getArray('blocks').push([m]);
  return m;
}
const textOf = (doc) => doc.getArray('blocks').get(0).get('text');

describe('CommentStore', () => {
  it('anchors, syncs, survives edits, replies/resolves, and orphans on delete', () => {
    const hub = new MemoryHub();
    const docA = new Y.Doc(), docB = new Y.Doc();
    hub.connect(docA); hub.connect(docB);
    seedBlock(docA, 'blk', 'hello world');
    const csA = new CommentStore(docA), csB = new CommentStore(docB);

    // comment on "world" (indices 6..11)
    const cid = csA.add({ blockId: 'blk', from: 6, to: 11, text: 'check this', author: 'Alice' });
    let tb = csB.list().find((t) => t.id === cid);
    expect(tb).toBeTruthy();                         // synced to B
    expect([tb.from, tb.to]).toEqual([6, 11]);
    expect(tb.replies[0].text).toBe('check this');
    expect(tb.orphaned).toBe(false);

    // insert before the anchor -> it follows the text
    textOf(docA).insert(0, 'XX ');
    let ta = csA.list().find((t) => t.id === cid);
    expect([ta.from, ta.to]).toEqual([9, 14]);

    // reply on B + resolve on A both propagate
    csB.reply(cid, { author: 'Bob', text: 'agreed' });
    csA.resolve(cid, true);
    ta = csA.list().find((t) => t.id === cid);
    tb = csB.list().find((t) => t.id === cid);
    expect(ta.replies.length).toBe(2);              // A sees B's reply
    expect(tb.resolved).toBe(true);                 // B sees A's resolve

    // delete the anchored text -> orphaned (range collapses)
    textOf(docA).delete(9, 5);                       // remove "world"
    ta = csA.list().find((t) => t.id === cid);
    expect(ta.orphaned).toBe(true);
  });

  it('rejects a zero-width or unknown-block anchor', () => {
    const doc = new Y.Doc();
    seedBlock(doc, 'blk', 'text');
    const cs = new CommentStore(doc);
    expect(cs.add({ blockId: 'blk', from: 2, to: 2, text: 'x', author: 'A' })).toBeNull();
    expect(cs.add({ blockId: 'nope', from: 0, to: 2, text: 'x', author: 'A' })).toBeNull();
    expect(cs.list().length).toBe(0);
  });
});
