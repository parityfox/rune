import * as Y from 'yjs';
import { encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';

/**
 * MemoryHub — in-process Yjs sync provider for the collab spike (#11, #12).
 *
 * Relays both document updates and (ephemeral) Awareness updates between all
 * connected peers, with no network. Tags relayed messages with origin `'hub'`
 * so they don't echo. `pause()`/`resume()` simulate offline concurrency;
 * `resume()` re-exchanges full doc + awareness state, mirroring a real provider
 * on reconnect. Spike stand-in for the `CollabProvider` interface (#10).
 */
export class MemoryHub {
  constructor() {
    this._peers = new Map();   // doc -> { doc, awareness, docHandler, awHandler }
    this._paused = false;
  }

  connect(doc, awareness = null) {
    const docHandler = (update, origin) => {
      if (origin === 'hub' || this._paused) return;
      for (const p of this._peers.values()) if (p.doc !== doc) Y.applyUpdate(p.doc, update, 'hub');
    };
    doc.on('update', docHandler);

    let awHandler = null;
    if (awareness) {
      awHandler = ({ added, updated, removed }, origin) => {
        if (origin === 'hub' || this._paused) return;
        const changed = added.concat(updated, removed);
        const update = encodeAwarenessUpdate(awareness, changed);
        for (const p of this._peers.values()) {
          if (p.awareness && p.awareness !== awareness) applyAwarenessUpdate(p.awareness, update, 'hub');
        }
      };
      awareness.on('update', awHandler);
    }

    this._peers.set(doc, { doc, awareness, docHandler, awHandler });
    return () => this.disconnect(doc);
  }

  disconnect(doc) {
    const p = this._peers.get(doc);
    if (!p) return;
    doc.off('update', p.docHandler);
    if (p.awareness && p.awHandler) p.awareness.off('update', p.awHandler);
    this._peers.delete(doc);
  }

  pause() { this._paused = true; }

  /** Re-enable relay and reconcile anything missed while paused. */
  resume() {
    this._paused = false;
    const peers = [...this._peers.values()];
    for (const a of peers) {
      for (const b of peers) {
        if (a === b) continue;
        Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc), 'hub');
        if (a.awareness && b.awareness) {
          const ids = [...a.awareness.getStates().keys()];
          applyAwarenessUpdate(b.awareness, encodeAwarenessUpdate(a.awareness, ids), 'hub');
        }
      }
    }
  }
}
