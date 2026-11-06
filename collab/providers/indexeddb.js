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
  // y-indexeddb chains on its open request with no rejection handler, so blocked
  // storage would surface as an unhandled rejection the moment it is constructed.
  // Probe first and only construct it when storage works.
  let idb = null;
  const ready = _storageAvailable().then((ok) => {
    if (ok) idb = new IndexeddbPersistence(name, doc);
    return ok;
  });
  // y-indexeddb's whenSynced only ever RESOLVES (on 'synced'); if IndexedDB is
  // blocked/unavailable (private mode, quota errors) it would hang forever.
  // Race it against a timeout so awaiters can fall back to network-only instead
  // of stalling. Resolves true once hydrated, false on timeout — never rejects,
  // so an unawaited promise can't trigger an unhandled rejection.
  let timer;
  const whenSynced = Promise.race([
    ready.then((ok) => (ok ? idb.whenSynced : null)).then((hydrated) => { clearTimeout(timer); return !!hydrated; }),
    new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeout); }),
  ]);
  return {
    get synced() { return !!idb?.synced; },
    whenSynced,
    clear: () => ready.then(() => idb?.clearData()),
    destroy: () => ready.then(() => { clearTimeout(timer); return idb?.destroy(); }),
  };
}

// A separate database: y-indexeddb creates its object stores on first upgrade, so
// opening the real name here would leave it with an empty one.
function _storageAvailable() {
  return new Promise((resolve) => {
    try {
      const probe = '__rune_idb_probe';
      const req = indexedDB.open(probe);
      req.onsuccess = () => {
        req.result.close();
        try { indexedDB.deleteDatabase(probe); } catch { /* best effort */ }
        resolve(true);
      };
      req.onerror = (e) => { e?.preventDefault?.(); resolve(false); };
      req.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
