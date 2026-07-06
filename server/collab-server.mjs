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

const MAX_BUFFERED = 8 * 1024 * 1024;   // backpressure: drop a consumer buffering > 8MB
const MSG_RATE     = 400;               // max inbound messages/sec per connection

const docs = new Map();   // room name -> WSSharedDoc

// Room names come straight off the URL path; constrain them so a client can't
// spin up unbounded Y.Docs under arbitrary or oversized names.
const ROOM_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

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
  if (conn.bufferedAmount > MAX_BUFFERED) { closeConn(doc, conn); return; }   // slow consumer
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

  // Never let a malformed frame escape the handler: a single truncated/garbage
  // message makes lib0/y-protocols throw, which would otherwise become an
  // uncaughtException and kill the whole process (every room, every user).
  // Drop the offending connection instead.
  let msgs = 0, windowStart = Date.now();
  conn.on('message', (data) => {
    const now = Date.now();
    if (now - windowStart >= 1000) { windowStart = now; msgs = 0; }
    if (++msgs > MSG_RATE) { closeConn(doc, conn); return; }   // too chatty -> drop the connection
    try { onMessage(conn, doc, new Uint8Array(data)); }
    catch { closeConn(doc, conn); }
  });
  conn.on('close', () => closeConn(doc, conn));

  // Heartbeat liveness: the reaper (startServer) pings periodically and drops any
  // socket that never ponged, so a connection that died without a FIN doesn't sit
  // in doc.conns forever — leaking its awareness state and pinning the room open.
  conn.isAlive = true;
  conn.on('pong', () => { conn.isAlive = true; });

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

/**
 * Start the reference server. Returns { server, wss, close() }.
 *
 * @param {number} port
 * @param {{ authorize?: (req, room) => boolean | Promise<boolean>,
 *           allowedOrigins?: string[] | ((origin: string|undefined) => boolean) }} [opts]
 *   authorize is called per connection BEFORE the WebSocket upgrade; return false
 *   (or throw) to reject with 401. The raw `req` carries the token — read it from
 *   the query (`?token=…` in `req.url`) or `req.headers`. Default (no hook) is
 *   open, so the demo stays zero-config. Plug real auth in here, e.g.:
 *     authorize: async (req) => verifyJwt(new URL(req.url, 'ws://x').searchParams.get('token'))
 *
 *   allowedOrigins gates the browser Origin on the handshake (defends against
 *   cross-site WebSocket hijacking). Pass an allowlist of exact origins, or a
 *   predicate. Non-matching origins are rejected with 403. Browsers always send
 *   Origin on a WS handshake, so a request with none (curl, native, S2S) is let
 *   through — a hostile page can't suppress it. Omit to stay open (reference
 *   default); ALWAYS set it (or cookie-independent token auth) in production.
 */
export function startServer(port = process.env.PORT || 1234, { authorize, allowedOrigins, maxRooms = 10000, heartbeatMs = 30_000 } = {}) {
  const _originAllowed = (origin) => {
    if (!allowedOrigins) return true;                          // not configured -> open
    if (typeof allowedOrigins === 'function') return !!allowedOrigins(origin);
    if (!origin) return true;                                  // non-browser client
    return (Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins]).includes(origin);
  };
  const server = http.createServer((_, res) => { res.writeHead(200); res.end('Rune collab server'); });
  // Cap inbound frames (ws default is 100MB) so one client can't buffer a huge
  // payload into the shared doc and fan it out to every peer.
  const wss = new WebSocketServer({ noServer: true, maxPayload: 5 * 1024 * 1024 });   // we drive the upgrade so we can gate it
  wss.on('connection', setupWSConnection);

  // Reap half-open connections: ping every client each tick and terminate any
  // that didn't pong since the last one. terminate() fires 'close', so closeConn
  // runs and the now-empty room is destroyed. unref so the loop never keeps the
  // process alive on its own.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* socket already going away */ }
    }
  }, heartbeatMs);
  heartbeat.unref?.();

  server.on('upgrade', async (req, socket, head) => {
    const room = (req.url || '/').slice(1).split('?')[0] || 'default';
    // Reject malformed room names and refuse to open new rooms past the cap.
    if (!ROOM_RE.test(room)) { socket.write('HTTP/1.1 400 Bad Request\r\n\r\n'); socket.destroy(); return; }
    if (!_originAllowed(req.headers.origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    if (!docs.has(room) && docs.size >= maxRooms) { socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); socket.destroy(); return; }
    let ok = true;
    if (authorize) { try { ok = await authorize(req, room); } catch { ok = false; } }
    if (!ok) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  server.listen(port);
  return {
    server, wss, port,
    close: () => new Promise((r) => {
      clearInterval(heartbeat);
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
