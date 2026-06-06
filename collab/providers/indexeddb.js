import { IndexeddbPersistence } from 'y-indexeddb';

/**
 * Local-first persistence (#13) — store a Y.Doc in IndexedDB so edits survive
 * reloads and offline sessions, loading instantly from cache before any network
 * sync. A thin wrapper over y-indexeddb.
 *
 *   const p = persistLocally(doc, 'my-room');
 *   await p.whenSynced;            // doc hydrated from IndexedDB
 *   if (doc.getArray('blocks').length === 0) seedFreshContent();
 *
 * @returns {{ whenSynced: Promise, synced: boolean, clear(): Promise, destroy(): Promise }}
 */
export function persistLocally(doc, name) {
  const idb = new IndexeddbPersistence(name, doc);
  return {
    get synced() { return idb.synced; },
    whenSynced: idb.whenSynced,
    clear: () => idb.clearData(),
    destroy: () => idb.destroy(),
  };
}
