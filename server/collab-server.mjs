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

// y-protocols/sync sub-message types (first varUint of a MESSAGE_SYNC body).
const SYNC_STEP1 = 0;    // read request  -> we reply with our state (step 2)
const SYNC_STEP2 = 1;    // apply remote state  -> writes the shared doc
const SYNC_UPDATE = 2;   // apply an update     -> writes the shared doc

const MAX_BUFFERED = 8 * 1024 * 1024;   // backpressure: drop a consumer buffering > 8MB
const MSG_RATE     = 400;               // max inbound messages/sec per connection

const docs = new Map();   // room name -> WSSharedDoc

// Room names come straight off the URL path; constrain them so a client can't
// spin up unbounded Y.Docs under arbitrary or oversized names. Reject `..` so a
// name can never become a path-traversal segment if a host adds file/DB
// persistence keyed by room.
const ROOM_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
function _validRoom(room) { return ROOM_RE.test(room) && !room.includes('..'); }

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

function onMessage(conn, doc, message, readOnly) {
  const dec = decoding.createDecoder(message);
  const type = decoding.readVarUint(dec);
  if (type === MESSAGE_SYNC) {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    const syncType = decoding.readVarUint(dec);
    if (syncType === SYNC_STEP1) {
      syncProtocol.readSyncStep1(dec, enc, doc);            // read request — always allowed
    } else if (!readOnly) {                                 // step2 / update mutate the doc
      if (syncType === SYNC_STEP2) syncProtocol.readSyncStep2(dec, doc, conn);
      else if (syncType === SYNC_UPDATE) syncProtocol.readUpdate(dec, doc, conn);
    }
    // read-only clients that send a write get it silently dropped here.
    if (encoding.length(enc) > 1) send(doc, conn, encoding.toUint8Array(enc));
  } else if (type === MESSAGE_AWARENESS) {
    // Ephemeral presence, not a document write — allowed even for read-only
    // viewers so their cursor still shows to everyone else.
    awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(dec), conn);
  }
}

/** Wire a freshly-accepted WebSocket connection into its room. */
export function setupWSConnection(conn, req) {
  conn.binaryType = 'arraybuffer';
  const room = (req?.url || '/').slice(1).split('?')[0] || 'default';
  // Re-validate here too: the upgrade gate only runs when startServer drives the
  // handshake. Anyone wiring wss.on('connection', setupWSConnection) directly (a
  // common raw-ws pattern) would otherwise skip room validation entirely.
  if (!_validRoom(room)) { try { conn.close(1008, 'invalid room'); } catch { /* already closed */ } return; }
  const doc = getDoc(room);
  doc.conns.set(conn, new Set());
  // authorize() may grant read-only access; such a connection receives updates
  // and presence but its writes to the shared doc are dropped (see onMessage).
  const readOnly = conn._runeCap === 'read';

  // Never let a malformed frame escape the handler: a single truncated/garbage
  // message makes lib0/y-protocols throw, which would otherwise become an
  // uncaughtException and kill the whole process (every room, every user).
  // Drop the offending connection instead.
  let msgs = 0, windowStart = Date.now();
  conn.on('message', (data) => {
    const now = Date.now();
    if (now - windowStart >= 1000) { windowStart = now; msgs = 0; }
    if (++msgs > MSG_RATE) { closeConn(doc, conn); return; }   // too chatty -> drop the connection
    try { onMessage(conn, doc, new Uint8Array(data), readOnly); }
    catch { closeConn(doc, conn); }
  });
  conn.on('close', () => closeConn(doc, conn));
  // A socket that emits 'error' (ECONNRESET, protocol error) with no listener
  // throws in ws, surfacing as an uncaughtException that takes down every room.
  // Drop the offending connection instead — same intent as the message guard.
  conn.on('error', () => closeConn(doc, conn));

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
 * @param {{ authorize?: (req, room) => (boolean|'read'|'write') | Promise<boolean|'read'|'write'>,
 *           allowedOrigins?: string[] | ((origin: string|undefined) => boolean) }} [opts]
 *   authorize is called per connection BEFORE the WebSocket upgrade; return false
 *   (or throw) to reject with 401. The raw `req` carries the token — read it from
 *   the query (`?token=…` in `req.url`) or `req.headers`. Default (no hook) is
 *   open, so the demo stays zero-config. Plug real auth in here, e.g.:
 *     authorize: async (req) => verifyJwt(new URL(req.url, 'ws://x').searchParams.get('token'))
 *
 *   Return 'read' to grant read-only access: the connection receives document
 *   updates and presence but its writes to the shared doc are dropped server-
 *   side. `true` / 'write' grant full read+write (the default when authorize is
 *   absent). WITHOUT an authorize hook the server is fully open — set one (and
 *   allowedOrigins, or token auth) before exposing it.
 *
 *   allowedOrigins gates the browser Origin on the handshake (defends against
 *   cross-site WebSocket hijacking). Pass an allowlist of exact origins, or a
 *   predicate. Non-matching origins are rejected with 403. Browsers always send
 *   Origin on a WS handshake, so a request with none (curl, native, S2S) is let
 *   through — a hostile page can't suppress it. Omit to stay open (reference
 *   default); ALWAYS set it (or cookie-independent token auth) in production.
 */
export function startServer(port = process.env.PORT || 1234, {
  authorize, allowedOrigins, maxRooms = 10000, heartbeatMs = 30_000,
  maxConnections = 10000, maxConnectionsPerIp = 50,
} = {}) {
  const ipCounts = new Map();   // remote IP -> live connection count
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
  // Swallow server-level socket errors so a failed handshake / reset can't bubble
  // up as an uncaughtException and crash the whole process.
  wss.on('error', () => { /* per-connection errors are handled on the conn */ });
  server.on('error', (err) => { console.error('[rune collab] server error:', err?.message || err); });

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
    if (!_validRoom(room)) { socket.write('HTTP/1.1 400 Bad Request\r\n\r\n'); socket.destroy(); return; }
    if (!_originAllowed(req.headers.origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    if (!docs.has(room) && docs.size >= maxRooms) { socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); socket.destroy(); return; }
    // Cap concurrent sockets globally and per source IP so one host (or a botnet
    // hitting one valid room, each under the message-rate limit) can't exhaust
    // file descriptors and memory.
    const ip = req.socket.remoteAddress || 'unknown';
    if (wss.clients.size >= maxConnections) { socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); socket.destroy(); return; }
    if ((ipCounts.get(ip) || 0) >= maxConnectionsPerIp) { socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n'); socket.destroy(); return; }
    let cap = 'write';
    if (authorize) {
      // Fail closed: only explicit grants authorize. Any other return value
      // (undefined from a missing `return false`, null/'' from a lookup miss,
      // 0/NaN) denies — never coerce a falsy non-false value to write access.
      try {
        const r = await authorize(req, room);
        cap = r === 'read' ? 'read' : (r === true || r === 'write') ? 'write' : false;
      } catch { cap = false; }
    }
    if (!cap) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws._runeCap = cap;
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
      ws.on('close', () => {
        const n = (ipCounts.get(ip) || 1) - 1;
        if (n <= 0) ipCounts.delete(ip); else ipCounts.set(ip, n);
      });
      wss.emit('connection', ws, req);
    });
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
