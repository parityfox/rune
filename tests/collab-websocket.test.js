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
});
