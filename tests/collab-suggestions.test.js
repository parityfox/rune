import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { MemoryHub } from '../collab/memory-hub.js';
import { SuggestionStore } from '../collab/suggestions.js';

// #15: tracked-change model — suggest insert/delete, accept/reject, synced.

function seedBlock(doc, id, text) {
  const m = new Y.Map();
  m.set('id', id); m.set('type', 'p');
  const t = new Y.Text(); t.insert(0, text); m.set('text', t);
  doc.getArray('blocks').push([m]);
}
const plain = (doc) => doc.getArray('blocks').get(0).get('text').toString();

describe('SuggestionStore', () => {
  it('insert suggestion: accept keeps text, reject removes it', () => {
    const doc = new Y.Doc(); seedBlock(doc, 'b', 'hello world');
    const s = new SuggestionStore(doc);
    const id = s.suggestInsert('b', 5, ' brave', 'Alice');   // "hello brave world"
    expect(plain(doc)).toBe('hello brave world');
    expect(s.list()).toEqual([expect.objectContaining({ id, type: 'insert', author: 'Alice', from: 5, to: 11 })]);

    s.accept(id);
    expect(plain(doc)).toBe('hello brave world');            // text kept
    expect(s.list()).toEqual([]);                            // mark gone

    // reject path
    const id2 = s.suggestInsert('b', 0, 'X', 'Bob');
    s.reject(id2);
    expect(plain(doc)).toBe('hello brave world');            // insertion removed
  });

  it('delete suggestion: text stays until accept; reject keeps it', () => {
    const doc = new Y.Doc(); seedBlock(doc, 'b', 'hello world');
    const s = new SuggestionStore(doc);
    const id = s.suggestDelete('b', 0, 6, 'Alice');          // mark "hello "
    expect(plain(doc)).toBe('hello world');                  // text NOT removed yet
    expect(s.list()).toEqual([expect.objectContaining({ id, type: 'delete', from: 0, to: 6 })]);

    s.reject(id);
    expect(plain(doc)).toBe('hello world');                  // kept
    expect(s.list()).toEqual([]);

    const id2 = s.suggestDelete('b', 0, 6, 'Alice');
    s.accept(id2);
    expect(plain(doc)).toBe('world');                        // now removed
  });

  it('syncs suggestions and their resolution between peers', () => {
    const hub = new MemoryHub();
    const docA = new Y.Doc(), docB = new Y.Doc();
    hub.connect(docA); hub.connect(docB);
    seedBlock(docA, 'b', 'abc');
    const sA = new SuggestionStore(docA), sB = new SuggestionStore(docB);

    const id = sA.suggestDelete('b', 0, 1, 'Alice');
    expect(sB.list()).toEqual([expect.objectContaining({ id, type: 'delete' })]);  // B sees it

    sB.accept(id);
    expect(plain(docA)).toBe('bc');                          // A sees B's accept
    expect(sA.list()).toEqual([]);
  });

  it('acceptAll / rejectAll', () => {
    const doc = new Y.Doc(); seedBlock(doc, 'b', 'one two three');
    const s = new SuggestionStore(doc);
    s.suggestInsert('b', 0, '* ', 'A');
    s.suggestDelete('b', 6, 10, 'A');                        // somewhere in the middle
    expect(s.list().length).toBe(2);
    s.acceptAll();
    expect(s.list().length).toBe(0);
  });
});
