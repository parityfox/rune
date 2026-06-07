/**
 * Rune collaborative-editing reference server.
 *
 * A minimal Yjs sync + awareness relay over WebSocket, one shared Y.Doc per
 * room (the URL path). Implements the standard y-websocket wire protocol so it
 * pairs with the y-websocket client (see collab/provider.js). Reference only —
 * not published in the npm package; hosts bring their own backend + auth.
 *
 *   PORT=1234 node server/collab-server.mjs
 */
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const docs = new Map();   // room name -> WSSharedDoc

class WSSharedDoc extends Y.Doc {
  constructor(name) {
    super();
    this.name = name;
    this.conns = new Map();                       // conn -> Set<controlled clientID>
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);

    this.awareness.on('update', ({ added, updated, removed }, conn) => {
      const changed = added.concat(updated, removed);
      if (conn !== null && this.conns.has(conn)) {
        const controlled = this.conns.get(conn);
        added.forEach((c) => controlled.add(c));
        removed.forEach((c) => controlled.delete(c));
      }
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
      this._broadcast(encoding.toUint8Array(enc));
    });

    this.on('update', (update) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeUpdate(enc, update);
      this._broadcast(encoding.toUint8Array(enc));
    });
  }

  _broadcast(bytes) {
    this.conns.forEach((_, conn) => send(this, conn, bytes));
  }
}

function getDoc(name) {
  let doc = docs.get(name);
  if (!doc) { doc = new WSSharedDoc(name); docs.set(name, doc); }
  return doc;
}

function send(doc, conn, bytes) {
  if (conn.readyState !== 0 && conn.readyState !== 1) { closeConn(doc, conn); return; }
  try { conn.send(bytes, (err) => err && closeConn(doc, conn)); }
  catch { closeConn(doc, conn); }
}

function closeConn(doc, conn) {
  if (doc.conns.has(conn)) {
    const controlled = doc.conns.get(conn);
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, [...controlled], null);
    if (doc.conns.size === 0) { doc.destroy(); docs.delete(doc.name); }
  }
  try { conn.close(); } catch { /* already closed */ }
}

function onMessage(conn, doc, message) {
  const dec = decoding.createDecoder(message);
  const type = decoding.readVarUint(dec);
  if (type === MESSAGE_SYNC) {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.readSyncMessage(dec, enc, doc, conn);
    if (encoding.length(enc) > 1) send(doc, conn, encoding.toUint8Array(enc));
  } else if (type === MESSAGE_AWARENESS) {
    awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(dec), conn);
  }
}

/** Wire a freshly-accepted WebSocket connection into its room. */
export function setupWSConnection(conn, req) {
  conn.binaryType = 'arraybuffer';
  const room = (req?.url || '/').slice(1).split('?')[0] || 'default';
  const doc = getDoc(room);
  doc.conns.set(conn, new Set());

  conn.on('message', (data) => onMessage(conn, doc, new Uint8Array(data)));
  conn.on('close', () => closeConn(doc, conn));

  // 1. sync step 1 (offer our state vector)
  const sync = encoding.createEncoder();
  encoding.writeVarUint(sync, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(sync, doc);
  send(doc, conn, encoding.toUint8Array(sync));

  // 2. current awareness states
  const states = doc.awareness.getStates();
  if (states.size > 0) {
    const aw = encoding.createEncoder();
    encoding.writeVarUint(aw, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(aw, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, [...states.keys()]));
    send(doc, conn, encoding.toUint8Array(aw));
  }
}

/** Start the reference server. Returns { server, wss, close() }. */
export function startServer(port = process.env.PORT || 1234) {
  const server = http.createServer((_, res) => { res.writeHead(200); res.end('Rune collab server'); });
  const wss = new WebSocketServer({ server });
  wss.on('connection', setupWSConnection);
  server.listen(port);
  return {
    server, wss, port,
    close: () => new Promise((r) => {
      for (const c of wss.clients) c.terminate();        // force-drop live sockets (a real bounce)
      wss.close(() => server.close(r));
    }),
  };
}

// CLI entry
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port } = startServer();
  console.log(`Rune collab server listening on :${port}`);
}
