import { describe, it, expect } from 'vitest';
import { uid } from '../../src/utils/id.js';

describe('uid', () => {
  it('returns a string', () => {
    expect(typeof uid()).toBe('string');
  });

  it('returns 8 characters', () => {
    expect(uid()).toHaveLength(8);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });
});
