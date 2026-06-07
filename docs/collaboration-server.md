# Collaboration Server & Deployment

`server/collab-server.mjs` is a **minimal reference sync server** for the
[`WebSocketProvider`](./collaboration-api.md#websocketprovider). It relays Yjs
document and Awareness updates between clients, one shared `Y.Doc` per room (the
URL path), speaking the standard `y-websocket` wire protocol.

> **Reference only.** It exists to make the collaboration layer runnable and
> testable end-to-end. It has an auth hook but no built-in persistence, presence
> garbage-collection tuning, or horizontal scaling. Production deployments
> should bring their own backend (see [Going to production](#going-to-production)).

- [Running it](#running-it)
- [How it works](#how-it-works)
- [API](#api)
- [Authentication](#authentication)
- [Persistence](#persistence)
- [Going to production](#going-to-production)

---

## Running it

```bash
npm run collab-server          # listens on :1234 (override with PORT)
PORT=8080 node server/collab-server.mjs
```

Point a client at it:

```js
import * as Y from 'yjs';
import { WebSocketProvider } from './collab/provider.js';

const provider = new WebSocketProvider('ws://localhost:1234', 'my-room', new Y.Doc());
```

Each distinct `room` (the second argument) is an independent document. A plain
`GET` to the HTTP port returns `Rune collab server` (a cheap health check).

---

## How it works

- One `Y.Doc` + `Awareness` per room, created lazily on first connection and
  discarded when the last client leaves.
- On connect, the server sends **sync step 1** (its state vector) and the current
  awareness states; thereafter it relays updates to every other client in the
  room.
- Messages are the standard `y-websocket` framing: `messageSync` (0) carrying
  `y-protocols/sync` payloads, and `messageAwareness` (1) carrying
  `y-protocols/awareness` updates.
- Convergence is the CRDT's job — if the server restarts, reconnecting clients
  re-push their state and the room doc is rebuilt from them.

The `WebSocketProvider` auto-reconnects with exponential backoff (capped at
`maxBackoffTime`). The provider's `onStatus`/`status`/`lastSynced` surface
connection state for a UI; see the [API reference](./collaboration-api.md#websocketprovider).

---

## API

The module exports two functions so you can embed it in your own HTTP server.

### `startServer(port?, { authorize? })`

Starts an HTTP + WebSocket server. Returns `{ server, wss, port, close() }`
(`close()` returns a Promise and terminates live sockets before closing).

```js
import { startServer } from './server/collab-server.mjs';
const srv = startServer(1234, { authorize });
// …later
await srv.close();
```

### `setupWSConnection(conn, req)`

Wires a single already-accepted WebSocket into its room. Use it if you manage the
WebSocket upgrade yourself (e.g. mounting onto an existing server):

```js
import { WebSocketServer } from 'ws';
import { setupWSConnection } from './server/collab-server.mjs';

const wss = new WebSocketServer({ server: myHttpServer });
wss.on('connection', setupWSConnection);
```

---

## Authentication

`startServer` accepts an optional `authorize(req, room)` hook, called **before**
the WebSocket upgrade. Return `false` (or throw) to reject the connection with
`401` before any socket is established. The default (no hook) is open, so the
demo stays zero-config.

```js
import { startServer } from './server/collab-server.mjs';

startServer(1234, {
  authorize: async (req, room) => {
    const token = new URL(req.url, 'ws://x').searchParams.get('token');
    const user = await verifyJwt(token);          // your auth
    return !!user && userCanAccessRoom(user, room);
  },
});
```

The raw `req` carries the credential — read it from the query string
(`?token=…`) or `req.headers`. Clients send it via the provider's `params`:

```js
new WebSocketProvider(url, room, doc, { params: { token } });
```

> The hook gates **connections**, not per-update authorization. For
> field-level/row-level rules, enforce them in your own provider/backend.

---

## Persistence

The reference server keeps room documents **in memory only** — they're lost when
the last client disconnects or the server restarts (clients re-seed on
reconnect). Two complementary options:

- **Client-side, local-first:** [`persistLocally`](./collaboration-api.md#persistlocally)
  (`y-indexeddb`) gives each client instant load + offline survival. This is
  built in and demoed.
- **Server-side, durable:** persist each room's Yjs update stream/snapshot to a
  database. Libraries like
  [`y-leveldb`](https://github.com/yjs/y-leveldb) or a custom store hook into the
  shared doc's `update` event. Not included in the reference server.

---

## Going to production

The reference server is a starting point. For a real deployment, layer on:

| Concern | Approach |
|---|---|
| **Durability** | Persist room updates to a DB (e.g. y-leveldb / Postgres); load on first connection |
| **AuthZ** | Use the `authorize()` hook for connection gating; enforce document permissions in your backend |
| **TLS** | Terminate `wss://` at a reverse proxy (nginx/Caddy) or Node's `https` server |
| **Scaling** | Multiple instances need a shared pub/sub (e.g. Redis) so rooms span processes — the in-memory relay is single-process |
| **Presence GC** | Tune Awareness timeouts; clean up stale clients |
| **Backpressure / limits** | Cap message size, connections per room, and rooms per instance |

Many teams adopt a hosted/maintained Yjs backend (e.g.
[Hocuspocus](https://tiptap.dev/hocuspocus) or a managed provider) instead of
operating their own — the `WebSocketProvider` speaks the standard `y-websocket`
protocol, so it interoperates with any `y-websocket`-compatible server.
