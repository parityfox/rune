import { describe, it, expect, afterEach } from 'vitest';
import { createFromConfig } from '../src/createFromConfig.js';

describe('createFromConfig (#160)', () => {
  let target, editor;
  afterEach(() => { editor?.destroy(); target?.remove(); });
  function make(config) {
    target = document.createElement('div'); document.body.appendChild(target);
    editor = createFromConfig(target, config);
    return editor.options.toolbar.items;
  }

  it('keeps toolbar items for extensions enabled by default', () => {
    expect(make({ toolbar: { items: ['bold', '|', 'heading', 'emoji'] } })).toEqual(['bold', '|', 'heading', 'emoji']);
  });

  it('drops items for extensions switched off', () => {
    expect(make({ marks: { bold: false }, toolbar: { items: ['bold', 'italic'] } })).toEqual(['italic']);
  });

  it('honours clearFormat: false', () => {
    expect(make({ formatting: { clearFormat: false }, toolbar: { items: ['clearFormat', 'indent'] } })).toEqual(['indent']);
  });

  it('drops unknown items', () => {
    expect(make({ toolbar: { items: ['nope', 'bold'] } })).toEqual(['bold']);
  });
});
