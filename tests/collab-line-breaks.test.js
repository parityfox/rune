import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';
import { CodeBlock } from '../src/extensions/blocks/CodeBlock.js';
import { Bold } from '../src/extensions/marks/Bold.js';
import { MemoryHub } from '../collab/memory-hub.js';
import { bindParagraph, textIndexInHost, domPointInHost, _internals } from '../collab/paragraph-binding.js';
import { CommentStore } from '../collab/comments.js';
import { SuggestionStore } from '../collab/suggestions.js';
import { bindSuggestionMode } from '../collab/suggestion-mode.js';

const { serializeInline, renderInline } = _internals;
const clean = (h) => h.replace(/ data-id="[^"]*"/g, '');
const el = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const text = (html) => serializeInline(el(html)).map((o) => o.insert).join('');
const roundTrip = (html) => {
  const out = document.createElement('div');
  renderInline(out, serializeInline(el(html)));
  return out.innerHTML;
};

describe('line breaks in the model (#187)', () => {
  describe('reading the DOM', () => {
    it('stores a break as a newline', () => {
      expect(text('one<br>two')).toBe('one\ntwo');
    });

    it('ignores the placeholder break of an empty block', () => {
      expect(serializeInline(el('<br>'))).toEqual([]);
    });

    it('ignores the invisible break at the end of a block', () => {
      expect(text('one<br>')).toBe('one');
    });

    it('keeps a real break before that invisible one', () => {
      expect(text('one<br><br>')).toBe('one\n');
    });

    it('keeps several breaks in a row', () => {
      expect(text('a<br><br>b')).toBe('a\n\nb');
    });

    it('keeps a leading break', () => {
      expect(text('<br>a')).toBe('\na');
    });

    it('ignores a trailing break nested inside a mark', () => {
      expect(text('<strong>one<br></strong>')).toBe('one');
    });

    it('keeps marks on a break', () => {
      expect(serializeInline(el('<strong>a<br>b</strong>'))).toMatchObject([{ insert: 'a\nb', attributes: { bold: true } }]);
    });

    it('treats a raw newline in HTML source as whitespace, keeping its length', () => {
      expect(text('one\ntwo')).toBe('one two');
    });
  });

  describe('writing the DOM', () => {
    for (const html of ['one<br>two', 'a<br><br>b', '<br>a', 'one<br><br>', '<strong>a<br>b</strong>']) {
      it(`round trips ${html}`, () => {
        const once = text(html);
        const out = document.createElement('div');
        renderInline(out, serializeInline(el(html)));
        expect(serializeInline(out).map((o) => o.insert).join('')).toBe(once);
      });
    }

    it('adds the placeholder that keeps a final break visible', () => {
      expect(roundTrip('one<br><br>')).toBe('one<br><br>');
    });

    it('still renders an empty block with one break', () => {
      expect(roundTrip('<br>')).toBe('<br>');
    });
  });

  describe('positions', () => {
    const host = (html) => el(html);

    it('counts a break as one character', () => {
      const h = host('one<br>two');
      expect(textIndexInHost(h, h.lastChild, 1)).toBe(5);
    });

    it('counts a break when the caret is on the block element', () => {
      const h = host('one<br>two');
      expect(textIndexInHost(h, h, 2)).toBe(4);
      expect(textIndexInHost(h, h, 3)).toBe(7);
    });

    it('counts a break inside a mark', () => {
      const h = host('<strong>a<br>b</strong>c');
      expect(textIndexInHost(h, h.lastChild, 1)).toBe(4);
    });

    it('counts a break when the caret is on a mark element', () => {
      const h = host('<strong>a<br>b</strong>');
      expect(textIndexInHost(h, h.firstChild, 2)).toBe(2);
    });

    it('does not count the placeholder break', () => {
      const h = host('<br>');
      expect(textIndexInHost(h, h, 1)).toBe(0);
      const t = host('one<br>');
      expect(textIndexInHost(t, t, 2)).toBe(3);
    });

    it('maps a position after a break to the next line', () => {
      const h = host('one<br>two');
      const p = domPointInHost(h, 5);
      expect(p.node).toBe(h.lastChild);
      expect(p.off).toBe(1);
    });

    it('maps the start of the next line into its text', () => {
      const h = host('one<br>two');
      const p = domPointInHost(h, 4);
      expect(p.node).toBe(h.lastChild);
      expect(p.off).toBe(0);
    });

    it('maps the end of a line before its break', () => {
      const h = host('one<br>two');
      const p = domPointInHost(h, 3);
      expect(p.node).toBe(h.firstChild);
      expect(p.off).toBe(3);
    });

    it('maps a position on an empty last line to just before the placeholder', () => {
      const h = host('one<br><br>');
      const p = domPointInHost(h, 4);
      expect(p.node).toBe(h);
      expect(p.off).toBe(2);
    });

    it('maps a position on a leading empty line', () => {
      const h = host('<br>a');
      const p = domPointInHost(h, 0);
      expect(p.node).toBe(h);
      expect(p.off).toBe(0);
    });

    it('stays the inverse of counting across every position', () => {
      const h = host('ab<br><strong>c<br>d</strong><br>e');
      for (let i = 0; i <= 7; i++) {
        const p = domPointInHost(h, i);
        expect(textIndexInHost(h, p.node, p.off)).toBe(i);
      }
    });
  });

  describe('between peers', () => {
    let hub, targets, editors;
    beforeEach(() => { hub = new MemoryHub(); targets = []; editors = []; });
    afterEach(() => { editors.forEach((e) => e.destroy()); targets.forEach((t) => t.remove()); });

    function peer(content) {
      const t = document.createElement('div'); document.body.appendChild(t); targets.push(t);
      const ed = new Editor(t, { extensions: [Paragraph, Bold, CodeBlock], toolbar: false, bubbleMenu: false, slashMenu: false, content });
      editors.push(ed);
      const doc = new Y.Doc();
      hub.connect(doc);
      hub.resume();
      bindParagraph(ed, doc);
      return { ed, doc };
    }
    const setPara = (ed, html, i = 0) => {
      ed.content.children[i].innerHTML = html;
      ed.content.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const caretIn = (node, off) => {
      const r = document.createRange(); r.setStart(node, off); r.collapse(true);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    };

    it('a break reaches the other peer', () => {
      const a = peer('<p>one</p>'), b = peer('');
      setPara(a.ed, 'one<br>two');
      expect(clean(b.ed.getHtml())).toBe('<p>one<br>two</p>');
    });

    it('a break survives a later edit from the other peer', () => {
      const a = peer('<p>one</p>'), b = peer('');
      setPara(a.ed, 'one<br>two');
      setPara(b.ed, 'one<br>two!');
      expect(clean(a.ed.getHtml())).toBe('<p>one<br>two!</p>');
      expect(clean(b.ed.getHtml())).toBe('<p>one<br>two!</p>');
    });

    it('a break at the end of a block stays visible on the other peer', () => {
      const a = peer('<p>one</p>'), b = peer('');
      setPara(a.ed, 'one<br><br>');
      expect(clean(b.ed.getHtml())).toBe('<p>one<br><br></p>');
    });

    it('content with a break seeds the room', () => {
      const a = peer('<p>one<br>two</p>'), b = peer('');
      expect(a.doc.getArray('blocks').get(0).get('text').toString()).toBe('one\ntwo');
      hub.resume();
      expect(clean(b.ed.getHtml())).toBe('<p>one<br>two</p>');
    });

    it('re-rendering an unchanged block does not rebuild it', () => {
      const a = peer('<p>one<br>two</p><p>other</p>'), b = peer('');
      hub.resume();
      const br = b.ed.content.querySelector('br');
      setPara(a.ed, 'changed', 1);
      expect(b.ed.content.querySelector('br')).toBe(br);
    });

    it('keeps a peer\'s caret on the same line when a remote edit lands above it', () => {
      const a = peer('<p>one<br>two</p>'), b = peer('');
      hub.resume();
      const line2 = b.ed.content.querySelector('p').lastChild;
      caretIn(line2, 2);
      setPara(a.ed, 'ONE!<br>two');
      const sel = window.getSelection();
      expect(sel.anchorNode.textContent).toBe('two');
      expect(sel.anchorOffset).toBe(2);
    });

    it('leaves code blocks to their own newlines', () => {
      const a = peer('<pre><code>a\nb</code></pre>'), b = peer('');
      hub.resume();
      expect(a.doc.getArray('blocks').get(0).get('text').toString()).toBe('a\nb');
      expect(b.ed.content.querySelector('pre').textContent).toBe('a\nb');
      expect(b.ed.content.querySelector('pre br')).toBeNull();
    });

    it('does not count a placeholder break in a code block', () => {
      const h = el('<pre><code>ab<br></code></pre>').firstChild;
      expect(textIndexInHost(h, h.firstChild, 2)).toBe(2);
    });

    it('a comment after a break stays on the same text', () => {
      const a = peer('<p>one<br>two</p>');
      const block = a.doc.getArray('blocks').get(0);
      const store = new CommentStore(a.doc);
      const id = store.add({ blockId: block.get('id'), from: 4, to: 7, text: 'n', author: 'A' });
      setPara(a.ed, 'ONE!<br>two');
      const t = store.list().find((x) => x.id === id);
      expect(block.get('text').toString().slice(t.from, t.to)).toBe('two');
      const host = a.ed.content.querySelector('p');
      const p1 = domPointInHost(host, t.from);
      expect(p1.node.data).toBe('two');
      expect(p1.off).toBe(0);
    });

    it('typing a suggestion after a break lands on the right line', () => {
      const a = peer('<p>one<br>two</p>');
      const store = new SuggestionStore(a.doc);
      bindSuggestionMode(a.ed, a.doc, { author: 'Ada', isEnabled: () => true });
      caretIn(a.ed.content.querySelector('p').lastChild, 3);
      const e = new Event('beforeinput', { bubbles: true, cancelable: true });
      Object.assign(e, { inputType: 'insertText', data: 'X' });
      a.ed.content.dispatchEvent(e);
      expect(a.doc.getArray('blocks').get(0).get('text').toString()).toBe('one\ntwoX');
      expect(store.list()).toMatchObject([{ type: 'insert', from: 7, to: 8 }]);
      expect(a.ed.content.querySelector('p br')).toBeTruthy();
      expect(window.getSelection().anchorNode.textContent).toBe('X');
    });

    it('typing a suggestion in a code block keeps its newlines as text', () => {
      const a = peer('<pre><code>a\nb</code></pre>');
      bindSuggestionMode(a.ed, a.doc, { author: 'Ada', isEnabled: () => true });
      const pre = a.ed.content.querySelector('pre');
      caretIn(pre.querySelector('code').firstChild, 3);
      const e = new Event('beforeinput', { bubbles: true, cancelable: true });
      Object.assign(e, { inputType: 'insertText', data: 'X' });
      a.ed.content.dispatchEvent(e);
      expect(pre.querySelector('br')).toBeNull();
      expect(pre.textContent).toBe('a\nbX');
      expect(a.doc.getArray('blocks').get(0).get('text').toString()).toBe('a\nbX');
    });

    it('a multi-line plain paste in suggestion mode shows its line breaks', () => {
      const a = peer('<p>one</p>');
      bindSuggestionMode(a.ed, a.doc, { author: 'Ada', isEnabled: () => true });
      caretIn(a.ed.content.querySelector('p').firstChild, 3);
      const e = new Event('paste', { bubbles: true, cancelable: true });
      e.clipboardData = { getData: (t) => (t === 'text/plain' ? '\nnext' : '') };
      a.ed.content.dispatchEvent(e);
      expect(a.ed.content.querySelector('p br')).toBeTruthy();
      expect(a.ed.content.querySelector('p').textContent).toBe('onenext');
    });
  });
});
