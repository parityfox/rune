import * as Y from 'yjs';

/**
 * MemoryHub — in-process Yjs sync provider for the Phase-1 spike (#11).
 *
 * Relays Yjs updates between all connected docs with no network. Tags relayed
 * updates with origin `'hub'` so they don't echo. `pause()`/`resume()` simulate
 * offline concurrency; `resume()` exchanges full state (state-vector sync),
 * mirroring what a real provider does on reconnect.
 *
 * This is the spike stand-in for the `CollabProvider` interface (#10).
 */
export class MemoryHub {
  constructor() {
    this._docs = new Set();
    this._paused = false;
    this._handlers = new Map();
  }

  connect(doc) {
    const handler = (update, origin) => {
      if (origin === 'hub' || this._paused) return;          // don't echo / hold while paused
      for (const other of this._docs) {
        if (other !== doc) Y.applyUpdate(other, update, 'hub');
      }
    };
    doc.on('update', handler);
    this._docs.add(doc);
    this._handlers.set(doc, handler);
    return () => this.disconnect(doc);
  }

  disconnect(doc) {
    const h = this._handlers.get(doc);
    if (h) doc.off('update', h);
    this._handlers.delete(doc);
    this._docs.delete(doc);
  }

  pause() { this._paused = true; }

  /** Re-enable relay and reconcile anything missed while paused (full state sync). */
  resume() {
    this._paused = false;
    const docs = [...this._docs];
    for (const a of docs) {
      for (const b of docs) {
        if (a !== b) Y.applyUpdate(b, Y.encodeStateAsUpdate(a), 'hub');
      }
    }
  }
}
