import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';
import { Bold } from '../src/extensions/marks/Bold.js';
import { collab } from '../collab/index.js';

describe('collab() facade (#79)', () => {
  let target, editor, doc, awareness;
  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
    doc = new Y.Doc();
    awareness = new Awareness(doc);
  });
  afterEach(() => { editor?.destroy(); target.remove(); });

  it('wires presence, comments and suggestions from one call', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, Bold], toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>hi</p>',
    });
    const session = collab(editor, { doc, awareness }, {
      user: { name: 'Ada', color: '#e03e3e' },
      presence: true, comments: true, suggestions: true,
    });

    expect(session.presence).toBeTruthy();
    expect(session.comments).toBeTruthy();
    expect(session.suggestions).toBeTruthy();
    expect(session.isSuggesting()).toBe(false);
    session.setSuggesting(true);
    expect(session.isSuggesting()).toBe(true);

    editor.destroy();   // aggregate teardown runs without throwing
    editor = null;
  });

  it('binds the document so DOM content seeds the shared doc', () => {
    editor = new Editor(target, {
      extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>seed</p>',
    });
    collab(editor, { doc, awareness }, { presence: false });
    expect(doc.getArray('blocks').length).toBeGreaterThan(0);
  });
});
