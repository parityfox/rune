import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rune } from '../../adapters/svelte/rune.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';

describe('Svelte action (#86)', () => {
  let node;
  beforeEach(() => { node = document.createElement('div'); document.body.appendChild(node); });
  afterEach(() => { node.remove(); });

  it('mounts an editor, exposed via onReady and node.__runeEditor', () => {
    let ready = null;
    const handle = rune(node, { extensions: [Paragraph], content: '<p>hi</p>', onReady: (e) => { ready = e; } });
    expect(ready).toBeTruthy();
    expect(node.__runeEditor).toBe(ready);
    expect(node.querySelector('.rune-content')?.textContent).toContain('hi');
    handle.destroy();
  });

  it('forwards onChange', () => {
    let changed = null;
    const handle = rune(node, { extensions: [Paragraph], content: '<p>x</p>', onChange: (h) => { changed = h; } });
    node.__runeEditor.setHtml('<p>y</p>');
    expect(changed).toContain('y');
    handle.destroy();
  });

  // #117: the `content` binding should be live (like the web component's
  // content attribute) — but guarded, so a round-trip of the editor's own
  // onChange value must NOT reset the document (and the caret with it).
  it('update() syncs a changed content param (#117)', () => {
    const handle = rune(node, { extensions: [Paragraph], content: '<p>one</p>' });
    handle.update({ extensions: [Paragraph], content: '<p>two</p>' });
    expect(node.__runeEditor.getHtml()).toContain('two');
    handle.destroy();
  });

  it('update() ignores content equal to the current document (#117)', () => {
    const handle = rune(node, { extensions: [Paragraph], content: '<p>one</p>' });
    const ed = node.__runeEditor;
    let sets = 0;
    const origSetHtml = ed.setHtml.bind(ed);
    ed.setHtml = (h) => { sets++; origSetHtml(h); };
    handle.update({ extensions: [Paragraph], content: ed.getHtml() });   // onChange round-trip
    expect(sets).toBe(0);
    handle.destroy();
  });

  it('update toggles readOnly and destroy cleans up', () => {
    const handle = rune(node, { extensions: [Paragraph], content: '<p>x</p>' });
    const ed = node.__runeEditor;
    handle.update({ extensions: [Paragraph], content: '<p>x</p>', readOnly: true });
    expect(ed.content.contentEditable).toBe('false');
    handle.update({ readOnly: false });
    expect(ed.content.contentEditable).toBe('true');
    handle.destroy();
    expect(node.__runeEditor).toBeUndefined();
    expect(node.querySelector('.rune-content')).toBeFalsy();
  });
});
