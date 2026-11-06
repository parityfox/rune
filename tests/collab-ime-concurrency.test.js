import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';
import { Bold } from '../src/extensions/marks/Bold.js';
import { MemoryHub } from '../collab/memory-hub.js';
import { bindParagraph } from '../collab/paragraph-binding.js';
import { SuggestionStore } from '../collab/suggestions.js';
import { bindSuggestionMode } from '../collab/suggestion-mode.js';

const clean = (h) => h.replace(/ data-id="[^"]*"/g, '');

describe('a peer edits the block being composed in (#189)', () => {
  let hub, targets, editors;
  beforeEach(() => { hub = new MemoryHub(); targets = []; editors = []; });
  afterEach(() => { editors.forEach((e) => e.destroy()); targets.forEach((t) => t.remove()); });

  function peer(content) {
    const t = document.createElement('div'); document.body.appendChild(t); targets.push(t);
    const ed = new Editor(t, { extensions: [Paragraph, Bold], toolbar: false, bubbleMenu: false, slashMenu: false, content });
    editors.push(ed);
    const doc = new Y.Doc();
    hub.connect(doc);
    hub.resume();
    bindParagraph(ed, doc);
    return { ed, doc };
  }
  const para = (p) => p.ed.content.querySelector('p');
  const ytext = (p) => p.doc.getArray('blocks').get(0).get('text');
  const fire = (p, type, data) => {
    const e = new Event(type, { bubbles: true });
    if (data !== undefined) e.data = data;
    p.ed.content.dispatchEvent(e);
  };
  function caret(node, off) {
    const r = document.createRange(); r.setStart(node, off); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function select(node, a, b) {
    const r = document.createRange(); r.setStart(node, a); r.setEnd(node, b);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  // The browser edits the DOM directly during composition; a peer's patch is deferred.
  function startComposing(a, at) {
    caret(para(a).firstChild, at);
    fire(a, 'compositionstart');
  }
  function composeText(a, at, text, removed = 0) {
    const n = para(a).firstChild;
    n.replaceData(at, removed, text);
    caret(n, at + text.length);
    fire(a, 'input');
  }
  const peerTypes = (b, html) => {
    para(b).innerHTML = html;
    fire(b, 'input');
  };

  it('keeps a peer\'s text in front of the composition', () => {
    const a = peer('<p>hello</p>'), b = peer('');
    startComposing(a, 5);
    composeText(a, 5, '你');
    peerTypes(b, 'PEER hello');
    fire(a, 'compositionend', '你');
    expect(ytext(a).toString()).toBe('PEER hello你');
    expect(clean(a.ed.getHtml())).toBe('<p>PEER hello你</p>');
    expect(clean(b.ed.getHtml())).toBe('<p>PEER hello你</p>');
  });

  it('keeps a peer\'s text after the composition', () => {
    const a = peer('<p>hello</p>'), b = peer('');
    startComposing(a, 2);
    composeText(a, 2, '你');
    peerTypes(b, 'hello PEER');
    fire(a, 'compositionend', '你');
    expect(ytext(a).toString()).toBe('he你llo PEER');
    expect(clean(b.ed.getHtml())).toBe('<p>he你llo PEER</p>');
  });

  it('keeps edits from a peer on both sides', () => {
    const a = peer('<p>hello</p>'), b = peer('');
    startComposing(a, 2);
    composeText(a, 2, '你');
    peerTypes(b, 'X hello');
    peerTypes(b, 'X hello Y');
    fire(a, 'compositionend', '你');
    expect(ytext(a).toString()).toBe('X he你llo Y');
  });

  it('loses nothing when the peer replaces the text around the caret', () => {
    const a = peer('<p>hello</p>'), b = peer('');
    startComposing(a, 2);
    composeText(a, 2, '你');
    peerTypes(b, 'different');
    fire(a, 'compositionend', '你');
    const text = ytext(a).toString();
    expect(text).toContain('你');
    expect(text.replace('你', '')).toBe('different');
    expect(clean(b.ed.getHtml())).toBe(`<p>${text}</p>`);
  });

  it('keeps the peer\'s deletion too', () => {
    const a = peer('<p>hello world</p>'), b = peer('');
    startComposing(a, 11);
    composeText(a, 11, '你');
    peerTypes(b, 'world');
    fire(a, 'compositionend', '你');
    expect(ytext(a).toString()).toBe('world你');
  });

  it('leaves the caret after the composed text', () => {
    const a = peer('<p>hello</p>'), b = peer('');
    startComposing(a, 5);
    composeText(a, 5, '你');
    peerTypes(b, 'PEER hello');
    fire(a, 'compositionend', '你');
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStart(para(a), 0);
    r.setEnd(sel.anchorNode, sel.anchorOffset);
    expect(r.toString()).toBe('PEER hello你');
  });

  it('composing over a selection replaces only that text', () => {
    const a = peer('<p>hello world</p>'), b = peer('');
    select(para(a).firstChild, 0, 5);
    fire(a, 'compositionstart');
    composeText(a, 0, '你', 5);
    peerTypes(b, 'hello world PEER');
    fire(a, 'compositionend', '你');
    expect(ytext(a).toString()).toBe('你 world PEER');
    expect(clean(b.ed.getHtml())).toBe('<p>你 world PEER</p>');
  });

  it('keeps the marks at the caret on the composed text', () => {
    const a = peer('<p><strong>hello</strong></p>'), b = peer('');
    const n = a.ed.content.querySelector('strong').firstChild;
    caret(n, 5);
    fire(a, 'compositionstart');
    n.insertData(5, '你');
    caret(n, 6);
    fire(a, 'input');
    ytext(b).insert(0, 'PEER ');
    fire(a, 'compositionend', '你');
    expect(ytext(a).toString()).toBe('PEER hello你');
    const op = ytext(a).toDelta().find((o) => o.insert.includes('你'));
    expect(op.attributes?.bold).toBe(true);
  });

  it('does not pick up the peer\'s marks on the composed text', () => {
    const a = peer('<p>hello</p>'), b = peer('');
    startComposing(a, 5);
    composeText(a, 5, '你');
    ytext(b).format(0, 5, { bold: true });
    fire(a, 'compositionend', '你');
    const op = ytext(a).toDelta().find((o) => o.insert.includes('你'));
    expect(op.attributes?.bold).toBeUndefined();
    expect(ytext(a).toDelta()[0].attributes?.bold).toBe(true);
  });

  it('keeps a peer\'s formatting of the same block', () => {
    const a = peer('<p>hello</p>'), b = peer('');
    startComposing(a, 5);
    composeText(a, 5, '你');
    ytext(b).format(0, 5, { bold: true });
    fire(a, 'compositionend', '你');
    expect(clean(a.ed.getHtml())).toBe('<p><strong>hello</strong>你</p>');
  });

  it('a cancelled composition keeps the peer\'s text', () => {
    const a = peer('<p>hello</p>'), b = peer('');
    startComposing(a, 5);
    peerTypes(b, 'PEER hello');
    fire(a, 'compositionend', '');
    expect(ytext(a).toString()).toBe('PEER hello');
    expect(clean(a.ed.getHtml())).toBe('<p>PEER hello</p>');
  });

  it('a block the peer removed stays removed', () => {
    const a = peer('<p>one</p><p>two</p>'), b = peer('');
    const second = a.ed.content.children[1];
    caret(second.firstChild, 3);
    fire(a, 'compositionstart');
    second.firstChild.insertData(3, '你');
    caret(second.firstChild, 4);
    fire(a, 'input');
    b.ed.content.children[1].remove();
    fire(b, 'input');
    fire(a, 'compositionend', '你');
    expect(a.doc.getArray('blocks').length).toBe(1);
    expect(clean(a.ed.getHtml())).toBe('<p>one</p>');
  });

  it('with no peer edit, a composition still commits normally', () => {
    const a = peer('<p>hello</p>'), b = peer('');
    startComposing(a, 5);
    composeText(a, 5, '你好');
    fire(a, 'compositionend', '你好');
    expect(clean(b.ed.getHtml())).toBe('<p>hello你好</p>');
  });

  it('a line break above the composition stays intact', () => {
    const a = peer('<p>one<br>two</p>'), b = peer('');
    const last = para(a).lastChild;
    caret(last, 3);
    fire(a, 'compositionstart');
    last.insertData(3, '你');
    caret(last, 4);
    fire(a, 'input');
    ytext(b).insert(0, 'P');
    fire(a, 'compositionend', '你');
    expect(ytext(a).toString()).toBe('Pone\ntwo你');
    expect(clean(a.ed.getHtml())).toBe('<p>Pone<br>two你</p>');
  });

  describe('in suggestion mode', () => {
    function suggesting(a) {
      bindSuggestionMode(a.ed, a.doc, { author: 'Ada', isEnabled: () => true });
      return new SuggestionStore(a.doc);
    }

    it('tracks the composed text, and keeps the peer\'s', () => {
      const a = peer('<p>hello</p>'), b = peer('');
      const store = suggesting(a);
      startComposing(a, 5);
      composeText(a, 5, '你');
      peerTypes(b, 'PEER hello');
      fire(a, 'compositionend', '你');
      expect(ytext(a).toString()).toBe('PEER hello你');
      const [s] = store.list();
      expect(s.type).toBe('insert');
      expect(ytext(a).toString().slice(s.from, s.to)).toBe('你');
    });

    it('composing over a selection keeps the deleted text marked, and the peer\'s text', () => {
      const a = peer('<p>hello world</p>'), b = peer('');
      const store = suggesting(a);
      select(para(a).firstChild, 0, 5);
      fire(a, 'compositionstart');          // the mode marks it and moves the caret after it
      const sel = window.getSelection();
      const node = sel.anchorNode;
      const at = sel.anchorOffset;
      node.insertData(at, '你');
      caret(node, at + 1);
      fire(a, 'input');
      peerTypes(b, para(b).innerHTML + ' PEER');
      fire(a, 'compositionend', '你');
      expect(ytext(a).toString()).toBe('hello你 world PEER');
      expect(store.list().map((s) => s.type).sort()).toEqual(['delete', 'insert']);
    });
  });
});
