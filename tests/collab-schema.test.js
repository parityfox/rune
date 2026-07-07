import { describe, it, expect } from 'vitest';
import { MARKS } from '../collab/schema.js';

const suggestion = MARKS.find((m) => m.key === 'suggestion');

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
