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
    expect(edB.getHtml()).toBe('<p>hello</p>');
  });

  it('converges under concurrent edits in the same paragraph', () => {
    hub.pause();
    editPara(edA, 0, 'Xhello');           // insert at start
    editPara(edB, 0, 'helloY');           // insert at end (concurrent)
    hub.resume();                         // exchange state -> CRDT merges both

    expect(edA.getHtml()).toBe(edB.getHtml());
    expect(edA.getHtml()).toBe('<p>XhelloY</p>');
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
    expect(edA.getHtml()).toBe('<p>ONE</p><p>TWO</p>');
  });

  it('syncs bold/italic marks', () => {
    editPara(edA, 0, 'a<strong>b</strong><em>c</em>');
    expect(edB.getHtml()).toBe('<p>a<strong>b</strong><em>c</em></p>');
  });

  it('syncs underline / strike / code marks', () => {
    editPara(edA, 0, '<u>u</u><s>s</s><code>c</code>');
    expect(edB.getHtml()).toBe('<p><u>u</u><s>s</s><code>c</code></p>');
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
    expect(edA.getHtml()).toBe('<p>Xhello</p>');
    const got = window.getSelection().getRangeAt(0);
    expect(got.startContainer.textContent).toBe('Xhello');
    expect(got.startOffset).toBe(4);      // "Xhel|lo" — still right after the original "hel"
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
