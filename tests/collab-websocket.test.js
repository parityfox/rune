import { describe, it, expect, afterEach } from 'vitest';
import * as Y from 'yjs';
import WebSocket from 'ws';
import { Awareness } from 'y-protocols/awareness';
import { startServer } from '../server/collab-server.mjs';
import { WebSocketProvider } from '../collab/provider.js';

// #10/#11/#12: real network transport — reference server + WebSocket clients.

const until = async (cond, ms = 3000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (cond()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return false;
};
const port = (srv) => new Promise((res) => {
  if (srv.server.listening) res(srv.server.address().port);
  else srv.server.on('listening', () => res(srv.server.address().port));
});

describe('WebSocket transport (reference server + provider)', () => {
  let srv, a, b;

  afterEach(async () => {
    a?.destroy(); b?.destroy();
    if (srv) await srv.close();
    srv = a = b = undefined;
  });

  it('converges two networked clients through the server', async () => {
    srv = startServer(0);
    const url = `ws://localhost:${await port(srv)}`;
    const docA = new Y.Doc(), docB = new Y.Doc();
    a = new WebSocketProvider(url, 'room1', docA, { WebSocketPolyfill: WebSocket });
    b = new WebSocketProvider(url, 'room1', docB, { WebSocketPolyfill: WebSocket });

    expect(await until(() => a.synced && b.synced)).toBe(true);

    docA.getText('t').insert(0, 'hello over the wire');
    expect(await until(() => docB.getText('t').toString() === 'hello over the wire')).toBe(true);

    // concurrent edits from both peers converge
    docB.getText('t').insert(0, '>> ');
    docA.getText('t').insert(docA.getText('t').length, ' <<');
    expect(await until(() => docA.getText('t').toString() === docB.getText('t').toString())).toBe(true);
    expect(docA.getText('t').toString()).toContain('hello over the wire');
  });

  it('relays awareness (presence) between networked clients', async () => {
    srv = startServer(0);
    const url = `ws://localhost:${await port(srv)}`;
    const docA = new Y.Doc(), docB = new Y.Doc();
    const awA = new Awareness(docA), awB = new Awareness(docB);
    a = new WebSocketProvider(url, 'room2', docA, { awareness: awA, WebSocketPolyfill: WebSocket });
    b = new WebSocketProvider(url, 'room2', docB, { awareness: awB, WebSocketPolyfill: WebSocket });

    expect(await until(() => a.synced && b.synced)).toBe(true);
    awA.setLocalStateField('user', { name: 'Alice' });

    expect(await until(() => awB.getStates().get(docA.clientID)?.user?.name === 'Alice')).toBe(true);
  });

  it('authorize() gates connections (rejects bad token, accepts good)', async () => {
    srv = startServer(0, {
      authorize: (req) => new URL(req.url, 'ws://x').searchParams.get('token') === 'good',
    });
    const url = `ws://localhost:${await port(srv)}`;

    const docBad = new Y.Doc();
    a = new WebSocketProvider(url, 'r', docBad, { WebSocketPolyfill: WebSocket, params: { token: 'bad' } });
    await new Promise((r) => setTimeout(r, 700));
    expect(a.synced).toBe(false);                 // rejected -> never syncs

    const docGood = new Y.Doc();
    b = new WebSocketProvider(url, 'r', docGood, { WebSocketPolyfill: WebSocket, params: { token: 'good' } });
    expect(await until(() => b.synced)).toBe(true);   // accepted
  }, 10000);

  it('rejects disallowed Origins on the handshake (CSWSH, #101)', async () => {
    srv = startServer(0, { allowedOrigins: ['https://app.example'] });
    const url = `ws://localhost:${await port(srv)}`;

    // A browser handshake from an untrusted page carries a foreign Origin -> 403.
    const evil = new WebSocket(`${url}/r`, { origin: 'https://evil.example' });
    const rejected = await new Promise((res) => {
      evil.on('close', () => res(true));
      evil.on('error', () => res(true));
      evil.on('open',  () => res(false));
      setTimeout(() => res(false), 1500);
    });
    expect(rejected).toBe(true);

    // The allowlisted origin connects and syncs.
    const okWs = new WebSocket(`${url}/r`, { origin: 'https://app.example' });
    const accepted = await new Promise((res) => {
      okWs.on('open',  () => res(true));
      okWs.on('close', () => res(false));
      okWs.on('error', () => res(false));
      setTimeout(() => res(false), 1500);
    });
    expect(accepted).toBe(true);
    try { okWs.close(); } catch { /* ignore */ }
  }, 10000);

  it('read-only connections receive updates but cannot write the doc (#102)', async () => {
    srv = startServer(0, {
      authorize: (req) => new URL(req.url, 'ws://x').searchParams.get('mode') === 'ro' ? 'read' : 'write',
    });
    const url = `ws://localhost:${await port(srv)}`;
    const docW = new Y.Doc(), docR = new Y.Doc();
    // disableBc: in one process y-websocket's cross-tab BroadcastChannel would
    // sync the two clients peer-to-peer and bypass the server. Real cross-origin
    // users never share that channel, so force all traffic through the server —
    // which is where the read/write capability is enforced.
    a = new WebSocketProvider(url, 'r', docW, { WebSocketPolyfill: WebSocket, params: { mode: 'rw' }, disableBc: true });
    b = new WebSocketProvider(url, 'r', docR, { WebSocketPolyfill: WebSocket, params: { mode: 'ro' }, disableBc: true });
    expect(await until(() => a.synced && b.synced)).toBe(true);

    // The writer's edit reaches the read-only viewer.
    docW.getText('t').insert(0, 'from-writer');
    expect(await until(() => docR.getText('t').toString() === 'from-writer')).toBe(true);

    // The read-only viewer's edit must NOT propagate back to the writer.
    docR.getText('t').insert(docR.getText('t').length, '-blocked');
    await new Promise((r) => setTimeout(r, 400));
    expect(docW.getText('t').toString()).toBe('from-writer');
  }, 10000);

  it('caps concurrent connections per IP (#104)', async () => {
    srv = startServer(0, { maxConnectionsPerIp: 2 });
    const url = `ws://localhost:${await port(srv)}`;
    const open = (n) => new Promise((res) => {
      const w = new WebSocket(`${url}/caproom`);
      w.on('open', () => res({ ok: true, w }));
      w.on('error', () => res({ ok: false, w }));
      w.on('close', () => res({ ok: false, w }));
      setTimeout(() => res({ ok: false, w }), 1500);
    });

    const r1 = await open(); const r2 = await open();
    expect(r1.ok && r2.ok).toBe(true);          // two allowed
    const r3 = await open();
    expect(r3.ok).toBe(false);                  // third from same IP rejected

    // Freeing a slot lets a new one in.
    r1.w.close();
    expect(await until(() => srv.wss.clients.size < 2, 2000)).toBe(true);
    const r4 = await open();
    expect(r4.ok).toBe(true);
    for (const r of [r2, r4]) { try { r.w.close(); } catch { /* ignore */ } }
  }, 10000);

  it('survives an abrupt socket reset without crashing the server (#105)', async () => {
    srv = startServer(0);
    const url = `ws://localhost:${await port(srv)}`;

    const ws = new WebSocket(`${url}/resetroom`);
    await new Promise((r) => ws.on('open', r));
    ws.on('error', () => { /* client-side reset noise */ });
    // Force an abrupt reset so the server-side socket emits 'error' (ECONNRESET)
    // rather than a clean close. Without a conn 'error' listener this became an
    // uncaughtException; the server must stay up.
    ws._socket.destroy(new Error('reset'));
    await new Promise((r) => setTimeout(r, 200));

    const docA = new Y.Doc(), docB = new Y.Doc();
    a = new WebSocketProvider(url, 'alive', docA, { WebSocketPolyfill: WebSocket });
    b = new WebSocketProvider(url, 'alive', docB, { WebSocketPolyfill: WebSocket });
    expect(await until(() => a.synced && b.synced)).toBe(true);
    docA.getText('t').insert(0, 'ok');
    expect(await until(() => docB.getText('t').toString() === 'ok')).toBe(true);
  }, 10000);

  it('reaps a half-open connection so its room does not leak (#103)', async () => {
    srv = startServer(0, { heartbeatMs: 80 });
    const url = `ws://localhost:${await port(srv)}`;

    const ws = new WebSocket(`${url}/reaproom`);
    await new Promise((r) => ws.on('open', r));
    expect(srv.wss.clients.size).toBe(1);

    // Pause the underlying socket: the client can no longer read the server's
    // ping frame, so it never auto-pongs — exactly a connection that died
    // without a FIN. The reaper must notice and terminate it.
    ws._socket.pause();
    expect(await until(() => srv.wss.clients.size === 0, 2000)).toBe(true);
    try { ws.terminate(); } catch { /* already gone */ }
  }, 10000);

  it('survives a malformed frame without crashing the server (#43)', async () => {
    srv = startServer(0);
    const url = `ws://localhost:${await port(srv)}`;

    // A raw client sends a truncated sync message (type byte, no body) that
    // makes y-protocols throw. Pre-fix this became an uncaughtException and
    // killed the whole process; now the bad connection is dropped instead.
    const bad = new WebSocket(`${url}/attack`);
    await new Promise((r) => bad.on('open', r));
    bad.send(new Uint8Array([0]));                 // MESSAGE_SYNC, empty body
    await new Promise((r) => setTimeout(r, 200));

    // The server must still be alive: a normal pair can connect and converge.
    const docA = new Y.Doc(), docB = new Y.Doc();
    a = new WebSocketProvider(url, 'survivors', docA, { WebSocketPolyfill: WebSocket });
    b = new WebSocketProvider(url, 'survivors', docB, { WebSocketPolyfill: WebSocket });
    expect(await until(() => a.synced && b.synced)).toBe(true);
    docA.getText('t').insert(0, 'still alive');
    expect(await until(() => docB.getText('t').toString() === 'still alive')).toBe(true);
    try { bad.close(); } catch { /* already gone */ }
  }, 10000);

  it('rejects malformed/oversized room names (#45)', async () => {
    srv = startServer(0);
    const url = `ws://localhost:${await port(srv)}`;

    // A 200-char room exceeds the 128-char limit -> 400 -> socket destroyed.
    const bad = new WebSocket(`${url}/${'x'.repeat(200)}`);
    const rejected = await new Promise((res) => {
      bad.on('close', () => res(true));
      bad.on('error', () => res(true));
      bad.on('open',  () => res(false));
      setTimeout(() => res(false), 1500);
    });
    expect(rejected).toBe(true);

    // A normal room still connects and syncs.
    const docA = new Y.Doc(), docB = new Y.Doc();
    a = new WebSocketProvider(url, 'good-room', docA, { WebSocketPolyfill: WebSocket });
    b = new WebSocketProvider(url, 'good-room', docB, { WebSocketPolyfill: WebSocket });
    expect(await until(() => a.synced && b.synced)).toBe(true);
  }, 10000);

  it('reconnects and re-syncs after the server bounces, surfacing status', async () => {
    srv = startServer(0);
    const p = await port(srv);
    const url = `ws://localhost:${p}`;
    const docA = new Y.Doc(), docB = new Y.Doc();
    const seen = [];
    a = new WebSocketProvider(url, 'r', docA, { WebSocketPolyfill: WebSocket });
    b = new WebSocketProvider(url, 'r', docB, { WebSocketPolyfill: WebSocket });
    a.onStatus((s) => seen.push(s.status));                       // immediate + transitions

    expect(await until(() => a.synced && b.synced)).toBe(true);
    expect(a.status).toBe('connected');
    expect(a.lastSynced).toBeTypeOf('number');
    docA.getText('t').insert(0, 'before');
    expect(await until(() => docB.getText('t').toString() === 'before')).toBe(true);

    await srv.close();                                            // bounce the server
    expect(await until(() => a.status !== 'connected', 4000)).toBe(true);   // notices the drop

    srv = startServer(p);                                         // restart on the same port
    expect(await until(() => a.status === 'connected' && b.status === 'connected', 9000)).toBe(true);
    expect(seen).toContain('reconnecting');                      // surfaced the reconnect

    docA.getText('t').insert(docA.getText('t').length, '-after'); // edits work after recovery
    expect(await until(() => docB.getText('t').toString().includes('-after'), 9000)).toBe(true);
  }, 25000);
});
