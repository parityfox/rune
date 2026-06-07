# Collaboration API Reference

API for the `collab/` modules. See **[collaboration.md](./collaboration.md)** for
concepts and **[collaboration-server.md](./collaboration-server.md)** for the
server. All modules are framework-agnostic ES modules; `editor` is a Rune
`Editor` instance and `doc` is a `Y.Doc`.

- [Transport](#transport)
  - [`WebSocketProvider`](#websocketprovider)
  - [`MemoryHub`](#memoryhub)
- [Binding](#binding) — [`bindParagraphSpike`](#bindparagraphspike), [DOM helpers](#dom-helpers)
- [Schema](#schema)
- [Presence](#presence) — [`bindPresence`](#bindpresence)
- [Comments](#comments) — [`CommentStore`](#commentstore), [`bindCommentsUI`](#bindcommentsui)
- [Suggestions](#suggestions) — [`SuggestionStore`](#suggestionstore), [`bindSuggestionMode`](#bindsuggestionmode)
- [Persistence](#persistence) — [`persistLocally`](#persistlocally)

---

## Transport

Both transports satisfy the **`CollabProvider`** contract the rest of the system
consumes:

```ts
interface CollabProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly synced: boolean;
  // … plus connect/disconnect/destroy on the networked provider
}
```

### `WebSocketProvider`

`collab/provider.js` — networked transport over the reference server.

```js
new WebSocketProvider(url, room, doc, opts?)
```

| Param | Type | Description |
|---|---|---|
| `url` | `string` | Base server URL, e.g. `'ws://localhost:1234'` |
| `room` | `string` | Document/room name |
| `doc` | `Y.Doc` | The document to sync |
| `opts.awareness` | `Awareness` | Presence channel (defaults to a new one) |
| `opts.WebSocketPolyfill` | `WebSocket` | **Required in Node** — pass the `ws` `WebSocket` |
| `opts.connect` | `boolean` | Connect immediately (default `true`) |
| `opts.maxBackoffTime` | `number` | Reconnect backoff cap, ms (default `2500`) |
| `opts.resyncInterval` | `number` | Periodic resync interval, ms (default `-1` = off) |
| `opts.params` | `Record<string,string>` | Query params (e.g. an auth `token` read by the server's `authorize()`) |

**Members:**

| Member | Description |
|---|---|
| `doc`, `awareness`, `synced` | The document, presence channel, and whether a full sync has completed |
| `status` | `'connecting' \| 'connected' \| 'reconnecting' \| 'disconnected'` |
| `lastSynced` | Timestamp (ms) of the last full sync, or `null` |
| `onStatus(cb)` | Subscribe to status/sync changes. Fires **immediately** with `{ status, synced, lastSynced }`, then on every change. Returns an unsubscribe fn. |
| `on(event, cb)` / `off(event, cb)` | Raw `y-websocket` events: `'status'`, `'sync'` |
| `connect()` / `disconnect()` / `destroy()` | Connection lifecycle |

```js
const provider = new WebSocketProvider('ws://localhost:1234', 'doc-42', doc, {
  awareness, params: { token },
});
const off = provider.onStatus(({ status, lastSynced }) => updateBadge(status, lastSynced));
```

### `MemoryHub`

`collab/memory-hub.js` — in-process relay between `Y.Doc`s in the same page.
Ideal for demos, tests, and the two-pane example. Not a network transport.

| Method | Description |
|---|---|
| `connect(doc, awareness?)` | Join the hub; relays doc (and awareness) updates to all other members. Returns a disconnect fn. |
| `disconnect(doc)` | Leave the hub |
| `pause()` | Stop relaying (simulate going offline) |
| `resume()` | Resume relaying and re-exchange full doc + awareness state (simulate reconnect) |

```js
const hub = new MemoryHub();
hub.connect(docA, awA);
hub.connect(docB, awB);
hub.pause();  /* …concurrent offline edits… */  hub.resume();   // CRDT merges
```

---

## Binding

### `bindParagraphSpike`

`collab/paragraph-binding.js` — the core Yjs ⇄ DOM binding.

```js
const handle = bindParagraphSpike(editor, doc)
handle.destroy()
```

Keeps `doc.getArray('blocks')` and the editor's contenteditable DOM in sync both
ways. On first run it **seeds** the document from the editor's DOM if the doc is
empty, otherwise **renders** the document into the editor. Handles convergence,
caret preservation (RelativePositions), id-keyed structural concurrency, minimal
run-level DOM patching, IME composition, and paste. Call `destroy()` to detach
all listeners.

> One binding per (editor, doc) pair. Pair it with a transport so edits
> propagate, and with [`bindPresence`](#bindpresence) for cursors.

### DOM helpers

Exported for presence/comments/suggestion UIs that need to map between the DOM
and text offsets. Each `flattenHosts` entry is `{ el, host, type, listType }` —
`el` is the top-level block element (carries `data-id`); `host` is the editable
region (differs from `el` only for `wrapped` blocks like callout).

| Function | Returns |
|---|---|
| `flattenHosts(content)` | Ordered list of block entries (lists → per-`li`, tables → per-cell) |
| `blockHostAt(content, node)` | `{ index, el, host, type, listType }` for the block containing `node` |
| `textIndexInHost(host, node, offset)` | Caret text-offset of a DOM point within `host` (or `-1`) |
| `domPointInHost(host, index)` | `{ node, off }` DOM point for a text offset within `host` |

---

## Schema

`collab/schema.js` — the declarative DOM ⇄ model mapping. Extend this to add a
mark or block type.

| Export | Description |
|---|---|
| `MARKS` | Inline marks in render-precedence order (outermost first). Each: `{ key, tags, create(doc, value?) }`; value marks add `value: true` + `read(el)`; object marks (suggestion) add `object: true`. |
| `BLOCKS` | Map of `type → { tag, kind, content?, … }`. `kind` is `text` \| `atomic` \| `wrapped`; `content` is `inline` \| `plain`. |
| `markForTag(tag)` | Mark spec for an inline tag, or `null` |
| `sameAttrs(a, b)` | Compare two attribute sets across all marks |
| `blockTypeForEl(el)` | Model `type` for a top-level element, or `null` |
| `isPlain(type)` / `kindOf(type)` | Content/kind lookups |

**Adding a boolean mark** is one line in `MARKS`:

```js
{ key: 'highlight', tags: ['mark'], create: (doc) => doc.createElement('mark') }
```

---

## Presence

### `bindPresence`

`collab/presence.js`

```js
bindPresence(editor, doc, awareness, { name, color, onChange? })
```

| Param | Type | Description |
|---|---|---|
| `awareness` | `Awareness` | The provider's awareness channel |
| `name` | `string` | Display name (default `'Anon'`; rendered escaped) |
| `color` | `string` | The user's color (default `'#888'`) — also used by their suggestions |
| `onChange` | `(roster) => void` | Called with the roster on every change |

Renders remote carets, selection-range highlights, and name labels in an overlay
outside the editable tree. `roster` entries: `{ id, name, color, typing, isSelf }`.

```js
bindPresence(editor, doc, provider.awareness, {
  name: 'Alice', color: '#2563eb',
  onChange: (roster) => renderAvatars(roster),
});
```

---

## Comments

### `CommentStore`

`collab/comments.js` — threaded comments anchored by RelativePosition.

```js
const comments = new CommentStore(doc)
```

| Method | Description |
|---|---|
| `add({ blockId, from, to, text, author })` | Create a thread anchored to `[from, to)` in a block. Returns the thread id (or `null` if invalid). |
| `reply(threadId, { author, text })` | Append a reply |
| `resolve(threadId, resolved = true)` | Resolve/unresolve |
| `remove(threadId)` | Delete a thread |
| `list()` | All threads with resolved positions: `{ id, blockId, from, to, resolved, author, ts, replies, orphaned }` |
| `observe(cb)` / `unobserve(cb)` | React to changes (threads + block text) |

### `bindCommentsUI`

`collab/comments-ui.js` — highlight overlay + selection-to-comment.

```js
const ui = bindCommentsUI(editor, doc, store, { onChange? })
ui.addFromSelection(author, text)   // create a thread from the current selection -> id|null
ui.render()                          // redraw highlights
ui.destroy()
```

`onChange(threads)` fires whenever threads change (drive your thread panel from it).

```js
const store = new CommentStore(doc);
const ui = bindCommentsUI(editor, doc, store, { onChange: renderThreadPanel });
addCommentButton.onclick = () => ui.addFromSelection('Alice', prompt('Comment:'));
```

---

## Suggestions

### `SuggestionStore`

`collab/suggestions.js` — the tracked-change model (resolution + queries).

```js
const sugg = new SuggestionStore(doc)
```

| Method | Description |
|---|---|
| `suggestInsert(blockId, pos, text, author, color?)` | Propose inserting `text` at `pos`. Returns id. |
| `suggestDelete(blockId, from, to, author, color?)` | Propose deleting `[from, to)` (marks it; text kept). Returns id. |
| `accept(id)` / `reject(id)` | Resolve one suggestion |
| `acceptAll()` / `rejectAll()` | Resolve all |
| `list()` | Open suggestions: `{ id, type, author, color, blockId, from, to }` |
| `observe(cb)` / `unobserve(cb)` | React to changes |

### `bindSuggestionMode`

`collab/suggestion-mode.js` — intercept editing so it produces tracked changes.

```js
bindSuggestionMode(editor, doc, { author, color?, isEnabled })
```

| Param | Type | Description |
|---|---|---|
| `author` | `string` | Change author (default `'Anon'`) |
| `color` | `string` | Author color stored on each change (match their presence color) |
| `isEnabled` | `() => boolean` | Gate — when it returns `false`, editing is normal |

When enabled, `insertText`, backspace, selection delete/replace, and paste all
become tracked changes (paste is sanitized). Returns `{ destroy() }`.

```js
let suggesting = false;
const sugg = new SuggestionStore(doc);
bindSuggestionMode(editor, doc, { author: 'Alice', color: '#2563eb', isEnabled: () => suggesting });
sugg.observe(() => renderReviewPanel(sugg.list()));   // Accept/Reject buttons -> sugg.accept(id) / sugg.reject(id)
```

---

## Persistence

### `persistLocally`

`collab/providers/indexeddb.js` — local-first persistence via `y-indexeddb`.

```js
const persist = persistLocally(doc, name)
await persist.whenSynced          // doc hydrated from IndexedDB
```

| Member | Description |
|---|---|
| `whenSynced` | Promise resolved once the doc is hydrated from IndexedDB |
| `synced` | Whether hydration has completed |
| `clear()` | Wipe this document's local store (Promise) |
| `destroy()` | Detach the persistence (Promise) |

```js
const persist = persistLocally(doc, 'doc-42');
await persist.whenSynced;
if (doc.getArray('blocks').length === 0) seedWelcomeContent();   // only on a fresh doc
bindParagraphSpike(editor, doc);
```
