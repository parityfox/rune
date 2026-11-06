import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';
import { MemoryHub } from '../collab/memory-hub.js';
import { bindParagraph } from '../collab/paragraph-binding.js';
import { collab } from '../collab/index.js';
import { SuggestionStore } from '../collab/suggestions.js';
import { CommentStore } from '../collab/comments.js';

const clean = (h) => h.replace(/ data-id="[^"]*"/g, '');
const fire = (ed, type) => ed.content.dispatchEvent(new Event(type, { bubbles: true }));

describe('collab binding', () => {
  let hub, targets, editors;
  beforeEach(() => { hub = new MemoryHub(); targets = []; editors = []; });
  afterEach(() => { editors.forEach((e) => e.destroy()); targets.forEach((t) => t.remove()); });

  function make(content) {
    const t = document.createElement('div'); document.body.appendChild(t); targets.push(t);
    const ed = new Editor(t, { extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false, content });
    editors.push(ed);
    return ed;
  }
  function peer(content) {
    const ed = make(content);
    const doc = new Y.Doc();
    hub.connect(doc);
    if (!hub._paused) hub.resume();   // connect doesn't catch up; a real provider's sync would
    bindParagraph(ed, doc);
    return { ed, doc };
  }
  function type(ed, i, text) {
    ed.content.children[i].textContent = text;
    fire(ed, 'input');
  }

  describe('mutations without a native input event (#136)', () => {
    it('setHtml reaches peers', () => {
      const a = peer('<p>hello</p>'), b = peer('');
      a.ed.setHtml('<p>replaced</p>');
      expect(clean(b.ed.getHtml())).toBe('<p>replaced</p>');
    });

    it('a setHtml survives the next remote update', () => {
      const a = peer('<p>hello</p>'), b = peer('');
      a.ed.setHtml('<p>replaced</p>');
      type(b.ed, 0, 'replaced!');
      expect(clean(a.ed.getHtml())).toBe('<p>replaced!</p>');
    });

    it('undo reaches peers', () => {
      const a = peer('<p>one</p>'), b = peer('');
      a.ed.history.saveNow();
      type(a.ed, 0, 'two');
      a.ed.history.saveNow();
      a.ed.history.undo();
      expect(clean(a.ed.getHtml())).toBe('<p>one</p>');
      expect(clean(b.ed.getHtml())).toBe('<p>one</p>');
    });

    it('applying a remote update does not echo back as a local edit', () => {
      const a = peer('<p>hello</p>'), b = peer('');
      let local = 0;
      b.doc.on('update', (_u, origin) => { if (origin === 'local') local++; });
      type(a.ed, 0, 'hello!');
      expect(local).toBe(0);
    });

    it('stops listening after destroy', () => {
      const c = make('<p>x</p>');
      const doc = new Y.Doc();
      const binding = bindParagraph(c, doc);
      binding.destroy();
      const before = Y.encodeStateVector(doc).toString();
      c.setHtml('<p>y</p>');
      expect(Y.encodeStateVector(doc).toString()).toBe(before);
    });
  });

  describe('IME commit with a remote insert above (#137)', () => {
    it('commits into the composed block, not the one now at its old index', () => {
      const a = peer('<p>one</p><p>two</p>'), b = peer('');
      const p = b.ed.content.children[1];
      const sel = window.getSelection();
      const r = document.createRange(); r.setStart(p.firstChild, 3); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);

      fire(b.ed, 'compositionstart');
      p.textContent = 'twoX';
      const r2 = document.createRange(); r2.setStart(p.firstChild, 4); r2.collapse(true);
      sel.removeAllRanges(); sel.addRange(r2);

      // A inserts a block above while B is composing.
      a.ed.content.insertBefore(Object.assign(document.createElement('p'), { textContent: 'zero' }), a.ed.content.firstChild);
      fire(a.ed, 'input');

      fire(b.ed, 'compositionend');
      expect(clean(b.ed.getHtml())).toBe('<p>zero</p><p>one</p><p>twoX</p>');
      expect(clean(a.ed.getHtml())).toBe('<p>zero</p><p>one</p><p>twoX</p>');
    });
  });

  describe('binding before the room state has arrived (#138)', () => {
    it('an empty editor adds no block to a non-empty room', () => {
      const a = peer('<p>hello</p>');
      hub.pause();
      const b = peer('');
      hub.resume();
      expect(a.doc.getArray('blocks').length).toBe(1);
      expect(clean(a.ed.getHtml())).toBe('<p>hello</p>');
      expect(clean(b.ed.getHtml())).toBe('<p>hello</p>');
    });

    it('an empty editor can still start an empty room by typing', () => {
      const a = peer(''), b = peer('');
      type(a.ed, 0, 'first');
      expect(clean(b.ed.getHtml())).toBe('<p>first</p>');
    });

    it('collab() holds non-empty local content back until the provider syncs', () => {
      const a = peer('<p>room</p>');
      hub.pause();
      const doc = new Y.Doc();
      hub.connect(doc);
      const handlers = new Set();
      const provider = {
        doc, synced: false,
        on: (ev, cb) => { if (ev === 'sync') handlers.add(cb); },
        off: (ev, cb) => handlers.delete(cb),
      };
      const ed = make('<p>template</p>');
      collab(ed, provider, { presence: false });
      expect(doc.getArray('blocks').length).toBe(0);
      hub.resume();
      provider.synced = true;
      handlers.forEach((cb) => cb(true));
      expect(a.doc.getArray('blocks').length).toBe(1);
      expect(clean(ed.getHtml())).toBe('<p>room</p>');
    });

    it('collab() seeds non-empty local content into a room that turns out empty', () => {
      const doc = new Y.Doc();
      const handlers = new Set();
      const provider = { doc, synced: false, on: (ev, cb) => handlers.add(cb), off: (ev, cb) => handlers.delete(cb) };
      const ed = make('<p>template</p>');
      collab(ed, provider, { presence: false });
      provider.synced = true;
      handlers.forEach((cb) => cb(true));
      expect(doc.getArray('blocks').length).toBe(1);
      expect(doc.getArray('blocks').get(0).get('text').toString()).toBe('template');
    });

    it('bindParagraph without a provider keeps seeding non-empty content at once', () => {
      const { doc } = peer('<p>seed</p>');
      expect(doc.getArray('blocks').length).toBe(1);
    });
  });

  describe('stores with an atomic image block (#150)', () => {
    function withImage() {
      const doc = new Y.Doc();
      const blocks = doc.getArray('blocks');
      const p = new Y.Map(); p.set('id', 'p1'); p.set('type', 'p');
      const text = new Y.Text(); text.insert(0, 'hi'); p.set('text', text);
      const img = new Y.Map(); img.set('id', 'i1'); img.set('type', 'image'); img.set('data', { src: 'x' });
      blocks.push([p, img]);
      return doc;
    }

    it('SuggestionStore lists, accepts and rejects around it', () => {
      const store = new SuggestionStore(withImage());
      const id = store.suggestInsert('p1', 0, 'x', 'Ada');
      expect(store.list().map((s) => s.id)).toEqual([id]);
      store.accept(id);
      expect(store.list()).toEqual([]);
    });

    it('SuggestionStore refuses to suggest on it', () => {
      const store = new SuggestionStore(withImage());
      expect(store.suggestInsert('i1', 0, 'x', 'Ada')).toBeNull();
      expect(store.suggestDelete('i1', 0, 1, 'Ada')).toBeNull();
    });

    it('CommentStore refuses to anchor on it', () => {
      expect(new CommentStore(withImage()).add({ blockId: 'i1', from: 0, to: 1, text: 't', author: 'a' })).toBeNull();
    });
  });

  describe('a remote block with no text (#170)', () => {
    it('does not stop later updates from rendering', () => {
      const a = peer('<p>hello</p>'), b = peer('');
      const bad = new Y.Map(); bad.set('id', 'bad'); bad.set('type', 'p');
      expect(() => a.doc.getArray('blocks').push([bad])).not.toThrow();
      expect(() => type(a.ed, 0, 'hello!')).not.toThrow();
      expect(b.ed.content.children[0].textContent).toBe('hello!');
    });
  });
});
