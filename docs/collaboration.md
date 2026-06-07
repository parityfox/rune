# Collaborative Editing

Rune ships an **opt-in, real-time collaborative editing** layer (in `collab/`)
built on [Yjs](https://github.com/yjs/yjs) CRDTs. Multiple users edit the same
document concurrently — over a network or in-process — with live presence,
comments, and tracked-change suggestions. The core editor stays
dependency-free; the collaboration layer's dependencies (`yjs`, `y-protocols`,
`y-websocket`, `y-indexeddb`, `ws`) are dev/server-only.

- **[API reference →](./collaboration-api.md)** — every module, signature, and example
- **[Server & deployment →](./collaboration-server.md)** — running the reference server, auth, persistence, scaling

---

## Contents

- [What you get](#what-you-get)
- [Quick start](#quick-start)
- [The live demo](#the-live-demo)
- [Architecture](#architecture)
- [The document model](#the-document-model)
- [Features in depth](#features-in-depth)
- [Testing](#testing)
- [Limitations & future work](#limitations--future-work)

---

## What you get

| Capability | Module | Notes |
|---|---|---|
| **Conflict-free co-editing** | `paragraph-binding.js` | Yjs ⇄ DOM binding; convergence under concurrent edits |
| **Block coverage** | `schema.js` | paragraphs, headings, lists, blockquote, code, image, table, callout |
| **All inline marks** | `schema.js` | bold/italic/underline/strike/code/link (href sanitized) |
| **Live presence** | `presence.js` | remote carets, selection highlights, typing, roster |
| **Comments** | `comments.js` + `comments-ui.js` | threaded, anchored, resolve, orphan handling |
| **Suggestions / tracked changes** | `suggestions.js` + `suggestion-mode.js` | type/paste/range, per-author color, accept-reject |
| **Networked transport** | `provider.js` + `server/collab-server.mjs` | WebSocket provider + reference server (auth, reconnect) |
| **In-process transport** | `memory-hub.js` | stand-in for demos/tests; offline pause/resume |
| **Offline persistence** | `providers/indexeddb.js` | local-first load + survives reloads |

Everything is verified at the unit (Vitest + happy-dom) and real-browser
(Playwright/CDP) levels.

---

## Quick start

A single editor synced over the network:

```js
import * as Y from 'yjs';
import { WebSocketProvider }   from './collab/provider.js';
import { bindParagraphSpike }  from './collab/paragraph-binding.js';
import { bindPresence }        from './collab/presence.js';
import { persistLocally }      from './collab/providers/indexeddb.js';

const doc = new Y.Doc();

// 1. Transport — connect to a sync server (see server docs).
const provider = new WebSocketProvider('ws://localhost:1234', 'my-doc', doc, {
  params: { token: authToken },         // optional: read by the server's authorize() hook
});

// 2. (Optional) local-first persistence — hydrate before binding.
const local = persistLocally(doc, 'my-doc');
await local.whenSynced;

// 3. Bind the editor's DOM to the Yjs document.
bindParagraphSpike(editor, doc);

// 4. Presence — your cursor/selection broadcast to peers.
bindPresence(editor, doc, provider.awareness, { name: 'Alice', color: '#2563eb' });

// 5. (Optional) connection-status UI.
provider.onStatus(({ status, lastSynced }) => renderStatus(status, lastSynced));
```

`editor` is a Rune `Editor` instance (see the main README). The binding seeds the
Yjs document from the editor's current DOM the first time, or renders the
document into the editor if it already has content (e.g. restored from IndexedDB
or a peer).

For local development without a server, swap the transport for the in-process
[`MemoryHub`](./collaboration-api.md#memoryhub):

```js
import { MemoryHub } from './collab/memory-hub.js';
const hub = new MemoryHub();
hub.connect(docA, awarenessA);
hub.connect(docB, awarenessB);   // docA and docB now stay in sync in one page
```

---

## The live demo

A two-pane demo (Alice & Bob editing the same document) wires up every feature:

```bash
npm run collab-server        # start the reference sync server (optional; demo also runs in-process)
npm run example              # serve the repo at http://localhost:4000
# open http://localhost:4000/examples/collab
```

The demo (`examples/collab.html`) shows live cursors + selection highlights,
typing indicators, a roster, comments, suggestion mode with a review panel,
per-author colors, offline toggle, and IndexedDB persistence ("Clear local"
resets it). It uses the in-process `MemoryHub` so it runs from static files;
apps wanting real multi-machine sync use `WebSocketProvider`.

> The demo imports `yjs` / `y-protocols` / `y-indexeddb` from a prebuilt bundle
> (`examples/vendor/collab-deps.mjs`). Rebuild it with `npm run build:demo`.

---

## Architecture

The layers, from transport up to UI:

```
┌──────────────────────────────────────────────────────────────┐
│  UI helpers      presence.js · comments-ui.js · suggestion-mode.js │
├──────────────────────────────────────────────────────────────┤
│  Binding         paragraph-binding.js   (Yjs Doc ⇄ editor DOM) │
│  Schema          schema.js              (DOM ⇄ model mapping)  │
│  Domain stores   comments.js · suggestions.js                 │
├──────────────────────────────────────────────────────────────┤
│  Transport       provider.js (WebSocket) · memory-hub.js       │
│  Persistence     providers/indexeddb.js                        │
├──────────────────────────────────────────────────────────────┤
│  CRDT            Yjs Doc + y-protocols Awareness               │
└──────────────────────────────────────────────────────────────┘
```

**Separation of concerns:**

- **Transport** is abstracted behind a `CollabProvider` contract (`doc`,
  `awareness`, `synced`, `status`, `connect/disconnect/destroy`, `on/off`). The
  binding and UI never know whether they're on a WebSocket or in-memory.
- **The schema** (`schema.js`) is the single declarative source of truth for the
  DOM ⇄ model mapping. Adding a mark or block type is a data change there, not
  edits scattered through the binding.
- **The binding** (`paragraph-binding.js`) keeps the Yjs document and the
  contenteditable DOM in sync, both directions, with minimal DOM churn and caret
  preservation.
- **Presence** lives on **ephemeral Awareness**, off the document — so cursors
  never enter the undo history or the saved content.
- **Comments** live in a separate `Y.Array`, anchored to text via
  RelativePositions. **Suggestions** are formatting marks on the block text.

---

## The document model

The document is a flat array of blocks:

```
doc.getArray('blocks')   →  Y.Array<Y.Map>
doc.getArray('comments') →  Y.Array<Y.Map>   (comment threads)
```

Each block is a `Y.Map`. Its shape depends on its **kind** (declared in
`schema.js`):

| Kind | Types | Fields |
|---|---|---|
| `text` | `p`, `h1`–`h6`, `blockquote`, `li`, `pre`, `cell` | `id`, `type`, `text: Y.Text` (+ `listType` for `li`; `tableId`/`r`/`c`/`header` for `cell`) |
| `atomic` | `image` | `id`, `type`, `data: { … }` (no editable text) |
| `wrapped` | `callout` | `id`, `type`, `text: Y.Text`, `emoji`, `color` (editable body + decoration) |

Key design choices:

- **Stable `data-id` keys.** Every block element carries a `data-id`. Concurrent
  insert/delete/reorder reconciles **by id**, so a peer's edit follows its block
  even as others restructure around it.
- **Inline marks are Yjs text-formatting attributes** on a block's `Y.Text`
  (see `MARKS` in `schema.js`). Render precedence is the array order
  (outermost first).
- **Lists and tables expand to per-item blocks.** A `<ul>`/`<ol>` becomes one
  `li` block per item; a `<table>` becomes one `cell` block per `<td>/<th>`
  (carrying its `tableId` + row/col). They regroup into the container element on
  render. This is what makes **per-cell concurrent editing** possible.
- **Caret preservation uses RelativePositions** captured in
  `doc.on('beforeTransaction')` — *before* a remote change integrates — then
  resolved back to an absolute index after the patch.
- **Minimal DOM patching.** Remote changes reuse existing block elements by
  `data-id` and patch inline content at the run level (only changed runs are
  replaced), so unchanged blocks/runs — and any live selection inside them — are
  never touched.

---

## Features in depth

### Presence (`bindPresence`)

Broadcasts your user identity, cursor, selection range, and typing state over
**ephemeral Awareness** (auto-expires when you go quiet — no tombstones in the
doc). Renders remote carets, selection-range highlights, and name labels in an
overlay layer *outside* the editable tree (never in `getHtml()`). The `onChange`
callback yields the roster for your own UI. Author names render via
`textContent` (escaped).

### Comments (`CommentStore` + `bindCommentsUI`)

Threaded comments in `doc.getArray('comments')`, each anchored to a text range
within a block via two RelativePositions. Anchors follow the text under
concurrent edits; if the anchored text is deleted, the thread is reported
`orphaned` rather than rendering a zero-width highlight. `bindCommentsUI` draws
range highlights in an overlay and creates threads from the current selection.

### Suggestions / tracked changes (`SuggestionStore` + `bindSuggestionMode`)

A tracked change is a `suggestion: { id, type, author, color? }` formatting
attribute on the block text:

- **insert** — proposed text is inserted and marked (rendered underlined);
  accept keeps it, reject removes it.
- **delete** — the range is marked (rendered struck-through, **kept** until
  resolved); accept removes it, reject keeps it.

`bindSuggestionMode` intercepts `beforeinput`/`paste` when enabled: typing,
backspace, **selection delete/replace**, and **paste** all become tracked
changes. Each author's changes render in their **presence color** (insert/delete
distinguished by *decoration*, so color is never the only signal). Accept/reject
(and accept-all/reject-all) live on `SuggestionStore` and sync to all peers.

### Offline / local-first (`persistLocally`)

Wraps `y-indexeddb` so a document loads instantly from the local cache before
any network sync and survives reloads. Pattern: `await persist.whenSynced`, then
seed fresh content only if the doc is empty. Offline edits merge cleanly on
reconnect (CRDT).

### Transport & resilience (`WebSocketProvider`)

Wraps the `y-websocket` client (auto-reconnect with exponential backoff). Adds a
derived `status` (`connecting` / `connected` / `reconnecting` / `disconnected`),
`lastSynced`, and `onStatus(cb)` for a connection-status UI. See the
[server docs](./collaboration-server.md) for the matching reference server and
the `authorize()` hook.

---

## Testing

| Command | What it covers |
|---|---|
| `npm test` | Unit suite (Vitest + happy-dom): convergence + fuzz, marks, all block types, comments, suggestions, transport, reconnect, auth |
| `npm run test:e2e` | Real-browser (Playwright + system Chrome): IME/paste, IndexedDB reload, suggestion mode. Requires Google Chrome. |

The collab tests live in `tests/collab-*.test.js` and `tests/e2e/collab-*.mjs`.

---

## Limitations & future work

These are intentional v1 boundaries, not bugs:

- **Tables** — no nested tables; `colspan`/`rowspan` and *concurrent* row/column
  add-remove are best-effort (cells are keyed by coordinates).
- **Suggestion mode** — range ops and paste are single-block; multi-block range
  operations fall back to normal editing.
- **The reference server** is exactly that — reference. It has an `authorize()`
  hook but no built-in persistence, presence GC tuning, or horizontal scaling.
  Production deployments bring their own backend (see server docs).
- **Backoff** is exponential + capped (provided by `y-websocket`); jitter would
  require forking that client.
