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
 *   readonly status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
 *   readonly lastSynced: number | null;
 *   connect(): void; disconnect(): void; destroy(): void;
 *   on(event: 'sync' | 'status', cb): void;
 *   off(event: string, cb): void;
 *   onStatus(cb): () => void;   // fires immediately + on every change
 * }
 */

/**
 * WebSocketProvider — networked CollabProvider over the reference server
 * (server/collab-server.mjs). Thin wrapper over the proven y-websocket client,
 * which auto-reconnects with exponential backoff (capped at `maxBackoffTime`).
 *
 * `status` derives a `reconnecting` state (was connected, now retrying) from the
 * raw connecting/connected flags, and `lastSynced` records the last full sync.
 * `onStatus(cb)` is the convenient subscription for a connection-status UI:
 * it fires immediately with the current state and again on every change.
 *
 * @param {string} url   base server URL, e.g. 'ws://localhost:1234'
 * @param {string} room  document/room name
 * @param {Y.Doc}  doc
 * @param {{ awareness?, WebSocketPolyfill?, connect?: boolean, maxBackoffTime?: number, resyncInterval?: number }} [opts]
 *        WebSocketPolyfill is required in Node (pass the `ws` WebSocket).
 */
export class WebSocketProvider {
  constructor(url, room, doc, opts = {}) {
    const { awareness, WebSocketPolyfill, connect = true, maxBackoffTime = 2500, resyncInterval = -1 } = opts;
    this._p = new WebsocketProvider(url, room, doc, { awareness, WebSocketPolyfill, connect, maxBackoffTime, resyncInterval });
    this._everConnected = false;
    this._lastSynced = null;
    this._statusCbs = new Set();
    this._onWsStatus = ({ status }) => { if (status === 'connected') this._everConnected = true; this._emit(); };
    this._onWsSync = (isSynced) => { if (isSynced) this._lastSynced = Date.now(); this._emit(); };
    this._p.on('status', this._onWsStatus);
    this._p.on('sync', this._onWsSync);
  }

  get doc() { return this._p.doc; }
  get awareness() { return this._p.awareness; }
  get synced() { return this._p.synced; }
  get lastSynced() { return this._lastSynced; }

  get status() {
    if (this._p.wsconnected) return 'connected';
    if (this._p.wsconnecting) return this._everConnected ? 'reconnecting' : 'connecting';
    return 'disconnected';
  }

  _state() { return { status: this.status, synced: this.synced, lastSynced: this._lastSynced }; }
  _emit() { const s = this._state(); for (const cb of this._statusCbs) cb(s); }

  /** Subscribe to status/sync changes. Fires immediately with the current state. Returns an unsubscribe. */
  onStatus(cb) { this._statusCbs.add(cb); cb(this._state()); return () => this._statusCbs.delete(cb); }

  on(event, cb) { this._p.on(event, cb); }
  off(event, cb) { this._p.off(event, cb); }

  connect() { this._p.connect(); }
  disconnect() { this._p.disconnect(); }
  destroy() {
    this._p.off('status', this._onWsStatus);
    this._p.off('sync', this._onWsSync);
    this._statusCbs.clear();
    this._p.destroy();
  }
}
