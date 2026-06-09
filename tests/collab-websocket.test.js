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
