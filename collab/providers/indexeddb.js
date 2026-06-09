import { IndexeddbPersistence } from 'y-indexeddb';

/**
 * Local-first persistence (#13) — store a Y.Doc in IndexedDB so edits survive
 * reloads and offline sessions, loading instantly from cache before any network
 * sync. A thin wrapper over y-indexeddb.
 *
 *   const p = persistLocally(doc, 'my-room');
 *   if (await p.whenSynced) {      // true = hydrated, false = timed out/unavailable
 *     if (doc.getArray('blocks').length === 0) seedFreshContent();
 *   }
 *
 * @param {object}  doc
 * @param {string}  name
 * @param {{ timeout?: number }} [opts] timeout (ms) before whenSynced gives up.
 * @returns {{ whenSynced: Promise<boolean>, synced: boolean, clear(): Promise, destroy(): Promise }}
 */
export function persistLocally(doc, name, { timeout = 10000 } = {}) {
  const idb = new IndexeddbPersistence(name, doc);
  // y-indexeddb's whenSynced only ever RESOLVES (on 'synced'); if IndexedDB is
  // blocked/unavailable (private mode, quota errors) it would hang forever.
  // Race it against a timeout so awaiters can fall back to network-only instead
  // of stalling. Resolves true once hydrated, false on timeout — never rejects,
  // so an unawaited promise can't trigger an unhandled rejection.
  let timer;
  const whenSynced = Promise.race([
    idb.whenSynced.then(() => { clearTimeout(timer); return true; }),
    new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeout); }),
  ]);
  return {
    get synced() { return idb.synced; },
    whenSynced,
    clear: () => idb.clearData(),
    destroy: () => idb.destroy(),
  };
}
