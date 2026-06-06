import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';
import { Bold } from '../src/extensions/marks/Bold.js';
import { Italic } from '../src/extensions/marks/Italic.js';
import { MemoryHub } from '../collab/memory-hub.js';
import { bindParagraphSpike } from '../collab/paragraph-binding.js';

// Phase-1 spike (#11): two editors, MemoryProvider, paragraphs + bold/italic.
// Proves (a) convergence under concurrent edits and (b) caret preservation.

const childPs = (ed) => [...ed.content.children].filter((e) => e.tagName === 'P');
const clean = (h) => h.replace(/ data-id="[^"]*"/g, '');  // ids are random; compare structure

function makeEditor(content) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const ed = new Editor(target, {
    extensions: [Paragraph, Bold, Italic],
    toolbar: false, bubbleMenu: false, slashMenu: false,
    content,
  });
  return ed;
}

// Simulate a local edit: replace a paragraph's inline HTML and fire `input`.
function editPara(ed, i, html) {
  childPs(ed)[i].innerHTML = html;
  ed.content.dispatchEvent(new Event('input', { bubbles: true }));
}

// Replace the whole editor content (block-level) and fire `input`.
function setContent(ed, html) {
  ed.content.innerHTML = html;
  ed.content.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('collab spike: two-editor convergence + caret', () => {
  let hub, edA, edB, docA, docB, a, b;

  beforeEach(() => {
    hub = new MemoryHub();
    docA = new Y.Doc();
    docB = new Y.Doc();
    hub.connect(docA);
    hub.connect(docB);

    edA = makeEditor('<p>hello</p>');
    edB = makeEditor('');                 // will receive content via sync
    a = bindParagraphSpike(edA, docA);    // seeds the shared doc from A's DOM
    b = bindParagraphSpike(edB, docB);    // renders B's DOM from the synced doc
  });

  afterEach(() => {
    a.destroy(); b.destroy();
    edA.destroy(); edB.destroy();
    document.body.innerHTML = '';
  });

  it('initial state syncs A -> B', () => {
    expect(clean(edB.getHtml())).toBe('<p>hello</p>');
  });

  it('converges under concurrent edits in the same paragraph', () => {
    hub.pause();
    editPara(edA, 0, 'Xhello');           // insert at start
    editPara(edB, 0, 'helloY');           // insert at end (concurrent)
    hub.resume();                         // exchange state -> CRDT merges both

    expect(edA.getHtml()).toBe(edB.getHtml());
    expect(clean(edA.getHtml())).toBe('<p>XhelloY</p>');
  });

  it('converges with concurrent edits in different paragraphs', () => {
    // grow to two paragraphs first, synced
    editPara(edA, 0, 'one');
    childPs(edA)[0].insertAdjacentHTML('afterend', '<p>two</p>');
    edA.content.dispatchEvent(new Event('input', { bubbles: true }));
    expect(childPs(edB).length).toBe(2);

    hub.pause();
    editPara(edA, 0, 'ONE');
    editPara(edB, 1, 'TWO');
    hub.resume();

    expect(edA.getHtml()).toBe(edB.getHtml());
    expect(clean(edA.getHtml())).toBe('<p>ONE</p><p>TWO</p>');
  });

  it('syncs bold/italic marks', () => {
    editPara(edA, 0, 'a<strong>b</strong><em>c</em>');
    expect(clean(edB.getHtml())).toBe('<p>a<strong>b</strong><em>c</em></p>');
  });

  it('syncs underline / strike / code marks', () => {
    editPara(edA, 0, '<u>u</u><s>s</s><code>c</code>');
    expect(clean(edB.getHtml())).toBe('<p><u>u</u><s>s</s><code>c</code></p>');
  });

  it('syncs headings and blockquote (block types)', () => {
    setContent(edA, '<h2>Title</h2><p>body</p><blockquote>quote</blockquote>');
    expect(clean(edB.getHtml())).toBe('<h2>Title</h2><p>body</p><blockquote>quote</blockquote>');
  });

  it('syncs code blocks as plain text (no inline marks)', () => {
    setContent(edA, '<pre><code>const x = 1;</code></pre>');
    expect(clean(edB.getHtml())).toBe('<pre><code>const x = 1;</code></pre>');
  });

  it('code block preserves symbols verbatim (no mark interpretation)', () => {
    setContent(edA, '<pre><code>if (a &lt; b) return *x*;</code></pre>');
    // the inner <code>/symbols are content, not marks
    expect(edB.getHtml()).toContain('if (a &lt; b) return *x*;');
    expect(clean(edB.getHtml())).toBe('<pre><code>if (a &lt; b) return *x*;</code></pre>');
  });

  it('syncs images as atomic blocks (void, src/alt preserved)', () => {
    setContent(edA, '<figure class="rune-image-block"><img src="https://x.com/a.png" alt="pic"></figure>');
    const b = clean(edB.getHtml());
    expect(b).toContain('rune-image-block');
    expect(b).toContain('src="https://x.com/a.png"');
    expect(b).toContain('alt="pic"');
  });

  it('drops a dangerous image src on render (security boundary)', () => {
    setContent(edA, '<figure class="rune-image-block"><img src="javascript:alert(1)" alt="x"></figure>');
    expect(edB.getHtml()).not.toContain('javascript:');
    expect(edB.getHtml()).toContain('rune-image-block');     // block kept, bad src dropped
  });

  it('syncs tables as opaque atomic blocks', () => {
    setContent(edA, '<table class="rune-table" data-type="table"><tbody><tr><td class="rune-table-cell">a</td><td class="rune-table-cell">b</td></tr></tbody></table>');
    const b = clean(edB.getHtml());
    expect(b).toContain('rune-table');
    expect(b).toContain('>a</td>');
    expect(b).toContain('>b</td>');
  });

  it('syncs callouts as opaque atomic blocks', () => {
    setContent(edA, '<div class="rune-callout rune-callout--yellow" data-type="callout"><span class="rune-callout-icon" contenteditable="false">i</span><div class="rune-callout-body">note text</div></div>');
    const b = clean(edB.getHtml());
    expect(b).toContain('rune-callout');
    expect(b).toContain('note text');
  });

  it('opaque block is not recreated when a different block changes (no churn)', () => {
    setContent(edA, '<p>intro</p><table class="rune-table"><tbody><tr><td class="rune-table-cell">x</td></tr></tbody></table>');
    const tableBefore = edB.content.querySelector('table');
    expect(tableBefore).toBeTruthy();
    edA.content.querySelector('p').textContent = 'INTRO';     // edit a different block
    edA.content.dispatchEvent(new Event('input', { bubbles: true }));
    expect(edB.content.querySelector('table')).toBe(tableBefore);   // reused, not recreated
  });

  it('syncs bullet and ordered lists (consecutive items grouped)', () => {
    setContent(edA, '<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>');
    expect(clean(edB.getHtml())).toBe('<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>');
  });

  it('converges on concurrent edits inside two list items', () => {
    setContent(edA, '<ul><li>one</li><li>two</li></ul>');
    expect(clean(edB.getHtml())).toBe('<ul><li>one</li><li>two</li></ul>');
    hub.pause();
    // A edits item 1, B edits item 2 (concurrent)
    const liA = edA.content.querySelectorAll('li')[0]; liA.textContent = 'ONE';
    edA.content.dispatchEvent(new Event('input', { bubbles: true }));
    const liB = edB.content.querySelectorAll('li')[1]; liB.textContent = 'TWO';
    edB.content.dispatchEvent(new Event('input', { bubbles: true }));
    hub.resume();
    expect(edA.getHtml()).toBe(edB.getHtml());
    expect(clean(edA.getHtml())).toBe('<ul><li>ONE</li><li>TWO</li></ul>');
  });

  it('changing a paragraph to a heading syncs as an attribute change', () => {
    setContent(edA, '<p>Heading text</p>');
    // promote to h1 (type change, text unchanged)
    edA.content.innerHTML = '<h1>Heading text</h1>';
    edA.content.dispatchEvent(new Event('input', { bubbles: true }));
    expect(clean(edB.getHtml())).toBe('<h1>Heading text</h1>');
  });

  it('id-keying: concurrent middle-insert + edit-elsewhere lands on the right block', () => {
    setContent(edA, '<p>one</p><p>two</p>');
    expect(clean(edB.getHtml())).toBe('<p>one</p><p>two</p>');   // both now carry matching data-ids

    hub.pause();
    // A inserts a new paragraph BETWEEN the two existing ones (existing ids kept)
    edA.content.querySelectorAll('p')[0].insertAdjacentHTML('afterend', '<p>mid</p>');
    edA.content.dispatchEvent(new Event('input', { bubbles: true }));
    // B concurrently edits the SECOND paragraph's text (keeps its data-id)
    edB.content.querySelectorAll('p')[1].textContent = 'two!';
    edB.content.dispatchEvent(new Event('input', { bubbles: true }));
    hub.resume();

    expect(edA.getHtml()).toBe(edB.getHtml());
    // B's edit followed the block by id — not clobbered by A's structural insert
    expect(clean(edA.getHtml())).toBe('<p>one</p><p>mid</p><p>two!</p>');
  });

  it('minimal patching: a remote edit elsewhere reuses untouched block DOM nodes', () => {
    setContent(edA, '<p>alpha</p><p>beta</p>');
    const p0Before = edB.content.querySelectorAll('p')[0];      // B's node for block 0
    edA.content.querySelectorAll('p')[1].textContent = 'BETA';  // A edits block 1
    edA.content.dispatchEvent(new Event('input', { bubbles: true }));
    const p0After = edB.content.querySelectorAll('p')[0];
    expect(p0After).toBe(p0Before);                             // same node — not recreated
    expect(clean(edB.getHtml())).toBe('<p>alpha</p><p>BETA</p>');
  });

  it('minimal patching: caret in an untouched block survives a remote edit elsewhere', () => {
    setContent(edA, '<p>hello</p><p>world</p>');
    const p0 = edB.content.querySelectorAll('p')[0];
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStart(p0.firstChild, 3); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);

    edA.content.querySelectorAll('p')[1].textContent = 'WORLD';  // remote edit elsewhere
    edA.content.dispatchEvent(new Event('input', { bubbles: true }));

    const got = window.getSelection().getRangeAt(0);
    expect(got.startContainer).toBe(p0.firstChild);             // same text node, untouched
    expect(got.startOffset).toBe(3);
  });

  it('IME: defers reconcile + remote patch until compositionend (no corruption)', () => {
    setContent(edA, '<p>hello</p><p>world</p>');
    const pA0 = childPs(edA)[0];
    const sel = window.getSelection();
    const r = document.createRange(); r.setStart(pA0.firstChild, 5); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);

    // A starts composing in paragraph 0
    edA.content.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    pA0.textContent = 'hellox';                                   // composed char
    const r2 = document.createRange(); r2.setStart(pA0.firstChild, 6); r2.collapse(true);
    sel.removeAllRanges(); sel.addRange(r2);
    edA.content.dispatchEvent(new Event('input', { bubbles: true }));
    expect(clean(edB.getHtml())).toContain('<p>hello</p>');       // composing text NOT synced yet

    // remote edit arrives at B's paragraph 1 during A's composition
    childPs(edB)[1].textContent = 'WORLD';
    edB.content.dispatchEvent(new Event('input', { bubbles: true }));
    expect(childPs(edA)[0].textContent).toBe('hellox');          // composition untouched
    expect(childPs(edA)[1].textContent).toBe('world');           // remote patch deferred

    // A ends composition -> commit composed block, then apply deferred remote
    edA.content.dispatchEvent(new Event('compositionend', { bubbles: true }));
    expect(clean(edA.getHtml())).toBe('<p>hellox</p><p>WORLD</p>');
    expect(edA.getHtml()).toBe(edB.getHtml());
  });

  it('id-keying: concurrent block delete + edit-elsewhere converges', () => {
    setContent(edA, '<p>a</p><p>b</p><p>c</p>');
    hub.pause();
    edA.content.querySelectorAll('p')[1].remove();             // A deletes the middle block
    edA.content.dispatchEvent(new Event('input', { bubbles: true }));
    edB.content.querySelectorAll('p')[2].textContent = 'C!';   // B edits the last block
    edB.content.dispatchEvent(new Event('input', { bubbles: true }));
    hub.resume();
    expect(edA.getHtml()).toBe(edB.getHtml());
    expect(clean(edA.getHtml())).toBe('<p>a</p><p>C!</p>');
  });

  it('syncs safe links and drops dangerous hrefs', () => {
    editPara(edA, 0, 'see <a href="https://ok.com">ok</a>');
    expect(edB.getHtml()).toContain('<a href="https://ok.com" target="_blank" rel="noopener noreferrer">ok</a>');

    editPara(edA, 0, 'x<a href="javascript:alert(1)">bad</a>');
    expect(edB.getHtml()).not.toContain('javascript:');
    expect(edB.getHtml()).not.toContain('<a');     // dangerous link stripped, text kept
    expect(edB.getHtml()).toContain('bad');
  });

  it('preserves the local caret when a remote edit arrives before it', () => {
    // caret in A after "hel" (index 3 of "hello")
    const pA = childPs(edA)[0];
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStart(pA.firstChild, 3);
    r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);

    // B inserts "X" at the very start -> relays live to A
    editPara(edB, 0, 'Xhello');

    // A converged and the caret tracked the same character (now index 4)
    expect(clean(edA.getHtml())).toBe('<p>Xhello</p>');
    const got = window.getSelection().getRangeAt(0);
    expect(got.startContainer.textContent).toBe('Xhello');
    expect(got.startOffset).toBe(4);      // "Xhel|lo" — still right after the original "hel"
  });

  it('renders + round-trips suggestion (tracked-change) marks', () => {
    setContent(edA, '<p>hello world</p>');
    docA.getArray('blocks').get(0).get('text').format(0, 5, { suggestion: { id: 's1', type: 'delete', author: 'Alice' } });
    let b = clean(edB.getHtml());
    expect(b).toContain('rune-suggestion--delete');
    expect(b).toContain('hello');
    // a later local edit preserves the suggestion mark (round-trip through serialize)
    edA.content.querySelector('p').lastChild.textContent = ' WORLD';
    edA.content.dispatchEvent(new Event('input', { bubbles: true }));
    b = clean(edB.getHtml());
    expect(b).toContain('rune-suggestion--delete');
    expect(b).toContain('WORLD');
  });

  it('no echo: a local edit does not re-trigger itself', () => {
    let renders = 0;
    const obs = (_e, txn) => { if (txn.origin !== 'local') renders++; };
    docA.getArray('blocks').observeDeep(obs);
    editPara(edA, 0, 'hello world');
    expect(renders).toBe(0);              // A's own edit produced no remote-style render on A
    docA.getArray('blocks').unobserveDeep(obs);
  });

  it('fuzz: converges over many random concurrent edits (seeded)', () => {
    let seed = 0x2545f491;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ch = () => String.fromCharCode(97 + Math.floor(rnd() * 26));

    const mutate = (ed) => {
      const p = childPs(ed)[0];
      const txt = p.textContent;
      let next;
      if (txt.length === 0 || rnd() < 0.7) {                 // insert
        const pos = Math.floor(rnd() * (txt.length + 1));
        next = txt.slice(0, pos) + ch() + txt.slice(pos);
      } else {                                               // delete
        const pos = Math.floor(rnd() * txt.length);
        next = txt.slice(0, pos) + txt.slice(pos + 1);
      }
      p.textContent = next;
      ed.content.dispatchEvent(new Event('input', { bubbles: true }));
    };

    editPara(edA, 0, 'start');                               // synced base
    for (let round = 0; round < 50; round++) {
      hub.pause();
      mutate(edA);                                           // concurrent edits...
      mutate(edB);                                           // ...on both peers
      hub.resume();                                          // CRDT merge
      expect(edA.getHtml()).toBe(edB.getHtml());             // converge every round
    }
    expect(edA.getHtml()).toBe(edB.getHtml());
  });
});
