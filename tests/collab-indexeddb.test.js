import { describe, it, expect, vi, afterEach } from 'vitest';

const ctor = vi.fn();
vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: class {
    constructor(name) { ctor(name); this.synced = true; this.whenSynced = Promise.resolve(this); }
    clearData() { return Promise.resolve('cleared'); }
    destroy() { return Promise.resolve('destroyed'); }
  },
}));
const { persistLocally } = await import('../collab/providers/indexeddb.js');

function fakeIndexedDB(works) {
  return {
    open: () => {
      const req = {};
      queueMicrotask(() => {
        if (works) { req.result = { close() {} }; req.onsuccess?.(); }
        else { req.error = new Error('InvalidStateError'); req.onerror?.({ preventDefault() {} }); }
      });
      return req;
    },
    deleteDatabase: () => ({}),
  };
}

describe('persistLocally when storage is blocked (#168)', () => {
  afterEach(() => { vi.unstubAllGlobals(); ctor.mockClear(); });

  it('never constructs the provider and resolves false', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB(false));
    const p = persistLocally({}, 'room');
    expect(await p.whenSynced).toBe(false);
    expect(ctor).not.toHaveBeenCalled();
    expect(p.synced).toBe(false);
  });

  it('destroy and clear resolve instead of rejecting', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB(false));
    const p = persistLocally({}, 'room');
    await expect(p.destroy()).resolves.toBeUndefined();
    await expect(p.clear()).resolves.toBeUndefined();
  });

  it('handles a browser with no indexedDB at all', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await persistLocally({}, 'room').whenSynced).toBe(false);
  });

  it('hydrates normally when storage works', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB(true));
    const p = persistLocally({}, 'room');
    expect(await p.whenSynced).toBe(true);
    expect(ctor).toHaveBeenCalledWith('room');
    expect(p.synced).toBe(true);
  });
});
