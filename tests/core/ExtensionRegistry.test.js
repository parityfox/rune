import { describe, it, expect } from 'vitest';
import { resolveExtensions } from '../../src/core/ExtensionRegistry.js';

const ext = (name, manifest = {}) => ({ name, type: 'plugin', ...manifest });

describe('resolveExtensions (#92)', () => {
  it('preserves order when there are no dependencies', () => {
    const r = resolveExtensions([ext('a'), ext('b'), ext('c')]);
    expect(r.map((e) => e.name)).toEqual(['a', 'b', 'c']);
  });

  it('topologically orders by dependsOn', () => {
    const r = resolveExtensions([ext('b', { dependsOn: ['a'] }), ext('a')]);
    expect(r.map((e) => e.name)).toEqual(['a', 'b']);
  });

  it('de-dupes by name (first wins)', () => {
    const r = resolveExtensions([ext('a'), ext('a')]);
    expect(r.length).toBe(1);
  });

  it('throws on a missing dependency', () => {
    expect(() => resolveExtensions([ext('b', { dependsOn: ['a'] })])).toThrow(/depends on missing/);
  });

  it('throws on a declared conflict', () => {
    expect(() => resolveExtensions([ext('a', { conflictsWith: ['b'] }), ext('b')])).toThrow(/conflicts with/);
  });

  it('throws on a dependency cycle', () => {
    expect(() => resolveExtensions([ext('a', { dependsOn: ['b'] }), ext('b', { dependsOn: ['a'] })])).toThrow(/[Cc]ircular/);
  });

  it('throws when an extension has no name', () => {
    expect(() => resolveExtensions([{ type: 'plugin' }])).toThrow(/must have a name/);
  });
});
