import { describe, it, expect } from 'vitest';
import { Schema } from '../../src/core/Schema.js';

const mockBlock = (name, tag, opts = {}) => ({ name, type: 'block', tag, ...opts });
const mockMark = (name, tag) => ({ name, type: 'mark', tag });
const mockFormatting = (name) => ({ name, type: 'formatting' });
const mockPlugin = (name) => ({ name, type: 'plugin' });

describe('Schema', () => {
  it('registers and retrieves blocks', () => {
    const s = new Schema();
    const p = mockBlock('paragraph', 'p');
    s.register(p);
    expect(s.getBlock('paragraph')).toBe(p);
    expect(s.blocks).toEqual([p]);
  });

  it('registers and retrieves marks', () => {
    const s = new Schema();
    const bold = mockMark('bold', 'strong');
    s.register(bold);
    expect(s.getMark('bold')).toBe(bold);
    expect(s.marks).toEqual([bold]);
  });

  it('registers and retrieves formatting', () => {
    const s = new Schema();
    const align = mockFormatting('textAlign');
    s.register(align);
    expect(s.formatting).toEqual([align]);
  });

  it('registers and retrieves plugins', () => {
    const s = new Schema();
    const p = mockPlugin('findReplace');
    s.register(p);
    expect(s.getPlugin('findReplace')).toBe(p);
    expect(s.plugins).toEqual([p]);
  });

  it('throws on missing name', () => {
    const s = new Schema();
    expect(() => s.register({ type: 'block' })).toThrow('must have a name');
  });

  it('throws on missing type', () => {
    const s = new Schema();
    expect(() => s.register({ name: 'x' })).toThrow('must have a type');
  });

  it('throws on unknown type', () => {
    const s = new Schema();
    expect(() => s.register({ name: 'x', type: 'unknown' })).toThrow('Unknown extension type');
  });

  describe('resolveBlock', () => {
    it('resolves by tag', () => {
      const s = new Schema();
      const p = mockBlock('paragraph', 'p');
      s.register(p);
      const el = document.createElement('p');
      expect(s.resolveBlock(el)).toBe(p);
    });

    it('resolves array tags', () => {
      const s = new Schema();
      const heading = mockBlock('heading', ['h1', 'h2', 'h3']);
      s.register(heading);
      expect(s.resolveBlock(document.createElement('h2'))).toBe(heading);
    });

    it('returns null for unregistered tags', () => {
      const s = new Schema();
      expect(s.resolveBlock(document.createElement('div'))).toBeNull();
    });

    it('returns null for null input', () => {
      const s = new Schema();
      expect(s.resolveBlock(null)).toBeNull();
    });

    it('uses match function to disambiguate shared tags', () => {
      const s = new Schema();
      const image = mockBlock('image', 'figure', {
        match: (el) => el.classList.contains('rune-image-block'),
      });
      const video = mockBlock('videoEmbed', 'figure', {
        match: (el) => el.classList.contains('rune-video-block'),
      });
      s.register(image);
      s.register(video);

      const imgFig = document.createElement('figure');
      imgFig.className = 'rune-image-block';
      expect(s.resolveBlock(imgFig)).toBe(image);

      const vidFig = document.createElement('figure');
      vidFig.className = 'rune-video-block';
      expect(s.resolveBlock(vidFig)).toBe(video);
    });

    it('falls back to tag-only match when no match function claims the element', () => {
      const s = new Schema();
      const generic = mockBlock('generic', 'figure');
      const specific = mockBlock('image', 'figure', {
        match: (el) => el.classList.contains('rune-image-block'),
      });
      s.register(generic);
      s.register(specific);

      const plain = document.createElement('figure');
      expect(s.resolveBlock(plain)).toBe(generic);
    });
  });

  describe('resolveMark', () => {
    it('resolves by tag', () => {
      const s = new Schema();
      const bold = mockMark('bold', 'strong');
      s.register(bold);
      expect(s.resolveMark(document.createElement('strong'))).toBe(bold);
    });

    it('returns null for unknown tags', () => {
      const s = new Schema();
      expect(s.resolveMark(document.createElement('span'))).toBeNull();
    });
  });

  describe('getKeymap', () => {
    it('collects keymaps from all extension types', () => {
      const s = new Schema();
      s.register({ name: 'p', type: 'block', tag: 'p', keymap: { 'a': 1 } });
      s.register({ name: 'b', type: 'mark', tag: 'strong', keymap: { 'b': 2 } });
      s.register({ name: 'f', type: 'formatting', keymap: { 'c': 3 } });
      s.register({ name: 'x', type: 'plugin', keymap: { 'd': 4 } });
      const km = s.getKeymap();
      expect(km).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });
  });

  describe('getToolbarItems', () => {
    it('collects toolbar items from all extension types', () => {
      const s = new Schema();
      s.register({ name: 'p', type: 'block', tag: 'p', toolbarItem: { name: 'p' } });
      s.register({ name: 'b', type: 'mark', tag: 'strong', toolbarItem: { name: 'b' } });
      s.register({ name: 'f', type: 'formatting', toolbarItem: { name: 'f' } });
      const items = s.getToolbarItems();
      expect(items.map(i => i.name)).toEqual(['p', 'b', 'f']);
    });

    it('caches toolbar items', () => {
      const s = new Schema();
      s.register({ name: 'p', type: 'block', tag: 'p', toolbarItem: { name: 'p' } });
      const first = s.getToolbarItems();
      const second = s.getToolbarItems();
      expect(first).toBe(second);
    });
  });

  describe('getSlashItems', () => {
    it('collects slash items from blocks only', () => {
      const s = new Schema();
      s.register({ name: 'p', type: 'block', tag: 'p', slashItem: { title: 'P' } });
      s.register({ name: 'b', type: 'mark', tag: 'strong', slashItem: { title: 'B' } });
      const items = s.getSlashItems();
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('P');
    });
  });
});
