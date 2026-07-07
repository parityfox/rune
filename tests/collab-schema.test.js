import { describe, it, expect } from 'vitest';
import { MARKS } from '../collab/schema.js';

const suggestion = MARKS.find((m) => m.key === 'suggestion');
const link = MARKS.find((m) => m.key === 'link');

// #127: the collab link mark validates hrefs with the positive scheme allowlist
// (_isAllowedHref) like the rest of the codebase, not the img-oriented denylist,
// so an exotic scheme a peer pushes is rejected on both read and create.
describe('collab schema link mark scheme allowlist (#127)', () => {
  it('rejects a non-allowlisted scheme on create', () => {
    expect(link.create(document, 'evil:payload')).toBeNull();
  });
  it('accepts http(s) and relative hrefs on create', () => {
    expect(link.create(document, 'https://y.com')).not.toBeNull();
    expect(link.create(document, '/relative')).not.toBeNull();
  });
  it('rejects a non-allowlisted scheme on read', () => {
    const a = document.createElement('a');
    a.setAttribute('href', 'evil:payload');
    expect(link.read(a)).toBeNull();
  });
});

// #126: suggestion.color is peer-controlled and reaches style.color /
// style.textDecorationColor. The color property setter already rejects url(),
// but laundering through _safeColor makes the whole class safe (and keeps it
// safe if the sink ever changes) — a hostile value becomes the #888 fallback,
// a valid one passes through.
describe('collab schema suggestion mark color laundering (#126)', () => {
  it('replaces a hostile peer color with the safe default', () => {
    const span = suggestion.create(document, { type: 'insert', color: 'url(https://evil.example/beacon)' });
    expect(span.getAttribute('style') || '').not.toContain('url(');
    // Pre-fix the raw url() was handed to the setter and rejected -> no color.
    // Post-fix the laundered #888 fallback is applied.
    expect(span.style.color).not.toBe('');
  });

  it('preserves a valid peer color', () => {
    const span = suggestion.create(document, { type: 'insert', color: 'rebeccapurple' });
    expect(span.style.color).toBe('rebeccapurple');
  });
});
