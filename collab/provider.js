import { WebsocketProvider } from 'y-websocket';

/**
 * CollabProvider (#10) — the transport-agnostic contract the binding consumes.
 * The binding (collab/paragraph-binding.js) and presence (collab/presence.js)
 * only ever touch `provider.doc` and `provider.awareness`; they never know the
 * transport. `MemoryHub` (collab/memory-hub.js) is the in-process stand-in;
 * `WebSocketProvider` below is the networked one.
 *
 * interface CollabProvider {
 *   readonly doc: Y.Doc;
 *   readonly awareness: Awareness;
 *   readonly synced: boolean;
 *   readonly status: 'connecting' | 'connected' | 'disconnected';
 *   connect(): void; disconnect(): void; destroy(): void;
 *   on(event: 'sync' | 'status', cb): void;
 *   off(event: string, cb): void;
 * }
 */

/**
 * WebSocketProvider — networked CollabProvider over the reference server
 * (server/collab-server.mjs). Thin wrapper over the proven y-websocket client.
 *
 * @param {string} url   base server URL, e.g. 'ws://localhost:1234'
 * @param {string} room  document/room name
 * @param {Y.Doc}  doc
 * @param {{ awareness?, WebSocketPolyfill?, connect?: boolean }} [opts]
 *        WebSocketPolyfill is required in Node (pass the `ws` WebSocket).
 */
export class WebSocketProvider {
  constructor(url, room, doc, opts = {}) {
    const { awareness, WebSocketPolyfill, connect = true } = opts;
    this._p = new WebsocketProvider(url, room, doc, { awareness, WebSocketPolyfill, connect });
  }

  get doc() { return this._p.doc; }
  get awareness() { return this._p.awareness; }
  get synced() { return this._p.synced; }
  get status() {
    if (this._p.wsconnected) return 'connected';
    if (this._p.wsconnecting) return 'connecting';
    return 'disconnected';
  }

  on(event, cb) {
    // 'sync' -> (isSynced: boolean); 'status' -> ({ status })
    this._p.on(event, cb);
  }
  off(event, cb) { this._p.off(event, cb); }

  connect() { this._p.connect(); }
  disconnect() { this._p.disconnect(); }
  destroy() { this._p.destroy(); }
}
