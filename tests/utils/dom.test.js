import { describe, it, expect } from 'vitest';
import { el, closest, isInside, getBlockElement, removeAllChildren } from '../../src/utils/dom.js';

describe('el', () => {
  it('creates an element with tag', () => {
    const node = el('div');
    expect(node.tagName).toBe('DIV');
  });

  it('sets class attribute', () => {
    const node = el('div', { class: 'my-class' });
    expect(node.className).toBe('my-class');
  });

  it('sets arbitrary attributes', () => {
    const node = el('input', { type: 'text', placeholder: 'hi' });
    expect(node.getAttribute('type')).toBe('text');
    expect(node.getAttribute('placeholder')).toBe('hi');
  });

  it('appends string children as text nodes', () => {
    const node = el('span', {}, 'hello');
    expect(node.textContent).toBe('hello');
  });

  it('appends element children', () => {
    const child = document.createElement('b');
    const node = el('p', {}, child);
    expect(node.firstChild).toBe(child);
  });

  it('handles multiple children', () => {
    const node = el('p', {}, 'hello ', el('strong', {}, 'world'));
    expect(node.childNodes.length).toBe(2);
    expect(node.textContent).toBe('hello world');
  });
});

describe('closest', () => {
  it('finds matching ancestor', () => {
    const parent = el('div', { class: 'target' });
    const child = el('span');
    parent.appendChild(child);
    expect(closest(child, '.target')).toBe(parent);
  });

  it('returns null when no match', () => {
    const node = el('div');
    expect(closest(node, '.nonexistent')).toBeNull();
  });
});

describe('isInside', () => {
  it('returns true for descendant', () => {
    const parent = el('div');
    const child = el('span');
    parent.appendChild(child);
    expect(isInside(child, parent)).toBe(true);
  });

  it('returns false for unrelated nodes', () => {
    const a = el('div');
    const b = el('div');
    expect(isInside(a, b)).toBe(false);
  });
});

describe('getBlockElement', () => {
  it('finds direct child of content element', () => {
    const content = el('div');
    const block = el('p');
    const inner = el('strong');
    block.appendChild(inner);
    content.appendChild(block);

    expect(getBlockElement(inner, content)).toBe(block);
  });

  it('returns null for unrelated node', () => {
    const content = el('div');
    const other = el('span');
    expect(getBlockElement(other, content)).toBeNull();
  });
});

describe('removeAllChildren', () => {
  it('removes all children from an element', () => {
    const node = el('div', {}, 'a', el('span'), 'b');
    expect(node.childNodes.length).toBe(3);
    removeAllChildren(node);
    expect(node.childNodes.length).toBe(0);
  });
});
