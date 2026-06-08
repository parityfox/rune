# Installation & Setup

How to install Rune and wire it into different stacks — and the separate process
for enabling [collaborative editing](./collaboration.md).

- [Requirements](#requirements)
- [Install](#install)
- [How the package ships](#how-the-package-ships)
- [Setup by stack](#setup-by-stack)
  - [Bundlers (Vite, webpack, Rollup, esbuild, Parcel)](#bundlers)
  - [Vanilla JS](#vanilla-js)
  - [Plain HTML — no bundler (CDN / import map)](#plain-html--no-bundler)
  - [React](#react) · [Next.js](#nextjs)
  - [Vue 3](#vue-3) · [Svelte](#svelte) · [Angular](#angular)
  - [Web Component (any framework)](#web-component-any-framework)
- [Enabling collaboration](#enabling-collaboration)
- [Verify & troubleshoot](#verify--troubleshoot)

---

## Requirements

- **A modern browser** with `contenteditable` (all evergreen browsers).
- **ES Modules.** Rune is ESM-only (`"type": "module"`). Use it with a bundler,
  native browser modules, or Node ≥ 16 ESM.
- **No runtime dependencies** for the core editor — it's dependency-free.
- A **bundler is recommended** but not required (see [no-bundler](#plain-html--no-bundler)).

---

## Install

```bash
npm install @parityfox/rune-editor      # or: yarn add @parityfox/rune-editor   /   pnpm add @parityfox/rune-editor
```

Import the stylesheet **once** in your app entry point:

```js
import '@parityfox/rune-editor/styles';
```

**From source (no install):** clone the repo and serve it statically —
`npx serve . -p 4000`, then open `examples/index.html`.

---

## How the package ships

Knowing this prevents most setup issues:

- **ESM source, no build step.** Rune ships its `src/` directly — there is no
  `dist/`. Modern bundlers consume the ESM source fine.
- **Subpath exports:**

  | Import | Resolves to |
  |---|---|
  | `rune-editor` | core (`Editor`, `createFromConfig`, extensions, utils) |
  | `rune-editor/react` | `useRune`, `RuneEditor` |
  | `rune-editor/web-component` | the `<rune-editor>` custom element |
  | `rune-editor/styles` | the stylesheet |

- **Dependency-free core.** The React adapter needs **React** in your app (it's a
  peer — install it yourself). The collaboration layer pulls in Yjs deps only
  when you use it (see [Enabling collaboration](#enabling-collaboration)).
- **`rune.config.js`** is shipped too — a feature-flag/extension preset you copy
  into your app and edit. The examples import it as `config`.

---

## Setup by stack

### Bundlers

Vite, webpack 5, Rollup, esbuild, and Parcel all handle Rune's ESM source out of
the box — `npm install` then import. No special configuration needed. The
snippets below assume a bundler unless stated otherwise.

> If your bundler complains about `.jsx` in the React adapter, ensure JSX/ESM
> transforms apply to `node_modules/@parityfox/rune-editor/adapters` (most setups do this
> by default; some require adding it to the transform include list).

### Vanilla JS

```js
import { createFromConfig } from '@parityfox/rune-editor';
import config from './rune.config.js';   // copied from the package
import '@parityfox/rune-editor/styles';

const editor = createFromConfig('#app', config, {
  content: '<p>Start writing…</p>',
  onChange(html) { console.log(html); },
});
```

`createFromConfig(target, config, overrides)` accepts a CSS selector **or** a DOM
element as `target`. For finer control, use the `Editor` class directly:

```js
import { Editor, Paragraph, Heading, Bold, Italic } from '@parityfox/rune-editor';
const editor = new Editor(document.querySelector('#app'), {
  extensions: [Paragraph, Heading, Bold, Italic],
  content: '<p>Hello</p>',
});
```

### Plain HTML — no bundler

Use an **import map** to resolve the bare specifier, served from a CDN that
exposes ESM (e.g. [esm.sh](https://esm.sh)):

```html
<link rel="stylesheet" href="https://esm.sh/rune-editor/styles/rune.css">

<div id="app"></div>

<script type="importmap">
{ "imports": { "rune-editor": "https://esm.sh/rune-editor" } }
</script>

<script type="module">
  import { Editor, Paragraph, Heading, Bold, Italic, BulletList } from '@parityfox/rune-editor';
  new Editor(document.querySelector('#app'), {
    extensions: [Paragraph, Heading, Bold, Italic, BulletList],
    content: '<p>Hello, no bundler!</p>',
  });
</script>
```

Self-hosting instead of a CDN? Point the import map at your copied
`node_modules/@parityfox/rune-editor/src/index.js` and serve the folder.

### React

Install React in your app, then use the adapter:

```jsx
import { RuneEditor } from '@parityfox/rune-editor/react';
import config from './rune.config.js';
import '@parityfox/rune-editor/styles';

export default function App() {
  return (
    <RuneEditor
      extensions={config.extensions}
      content="<p>Hello</p>"
      onChange={(html) => console.log(html)}
      toolbar bubbleMenu slashMenu
    />
  );
}
```

Props: `extensions`, `content`, `onChange`, `placeholder`, `toolbar`,
`bubbleMenu`, `slashMenu`, `readOnly`, `className`, `style`. For an editor handle,
use the hook directly:

```jsx
import { useRune } from '@parityfox/rune-editor/react';
function Editorish() {
  const { ref, editor } = useRune({ extensions: config.extensions, content: '<p>Hi</p>' });
  return <div ref={ref} />;
}
```

#### Next.js

The editor touches the DOM, so render it **client-side only** — disable SSR:

```jsx
'use client';
import dynamic from 'next/dynamic';
const RuneEditor = dynamic(
  () => import('@parityfox/rune-editor/react').then((m) => m.RuneEditor),
  { ssr: false },
);
```

### Vue 3

No dedicated adapter — mount the `Editor` on a ref:

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { createFromConfig } from '@parityfox/rune-editor';
import config from './rune.config.js';
import '@parityfox/rune-editor/styles';

const el = ref(null);
let editor;
onMounted(() => { editor = createFromConfig(el.value, config, { content: '<p>Hi</p>', onChange: (html) => {} }); });
onBeforeUnmount(() => editor?.destroy?.());
</script>

<template><div ref="el" /></template>
```

### Svelte

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { createFromConfig } from '@parityfox/rune-editor';
  import config from './rune.config.js';
  import '@parityfox/rune-editor/styles';

  let el, editor;
  onMount(() => { editor = createFromConfig(el, config, { content: '<p>Hi</p>' }); });
  onDestroy(() => editor?.destroy?.());
</script>

<div bind:this={el}></div>
```

### Angular

Either use the [web component](#web-component-any-framework) (simplest), or
instantiate `Editor` in `ngAfterViewInit` on a `@ViewChild` element ref and call
`editor.destroy()` in `ngOnDestroy`. Add `CUSTOM_ELEMENTS_SCHEMA` if you use the
web component in templates.

### Web Component (any framework)

Framework-agnostic — works in plain HTML, Angular, Vue, Svelte, etc.:

```html
<link rel="stylesheet" href="node_modules/@parityfox/rune-editor/styles/rune.css">
<script type="module" src="node_modules/@parityfox/rune-editor/adapters/web-component/rune-editor.js"></script>

<rune-editor content="<p>Hello world</p>" placeholder="Start writing…"></rune-editor>

<script>
  document.querySelector('rune-editor')
    .addEventListener('change', (e) => console.log(e.detail)); // html string
</script>
```

Attributes: `content`, `placeholder`, `readonly`. With a CDN, point the
`<script src>` at `https://esm.sh/rune-editor/web-component`.

---

## Enabling collaboration

Collaboration is **opt-in** and adds its own dependencies and a setup process.
Full details in **[collaboration.md](./collaboration.md)**; the short version:

**1. Install the collaboration dependencies** (only what you use):

```bash
# client: real-time sync + presence
npm install yjs y-protocols y-websocket
# client: offline/local-first persistence (optional)
npm install y-indexeddb
# server: the reference sync server (or your own backend)
npm install ws
```

**2. Pick a transport.**

- *In-process* ([`MemoryHub`](./collaboration-api.md#memoryhub)) — no server;
  great for demos/tests/single-page multi-pane.
- *Networked* ([`WebSocketProvider`](./collaboration-api.md#websocketprovider)) —
  run a sync server (next step) or any `y-websocket`-compatible backend.

**3. Run a sync server** (reference server included):

```bash
npm run collab-server          # listens on :1234 (PORT to override)
```

See **[collaboration-server.md](./collaboration-server.md)** for the
`authorize()` auth hook and production guidance.

**4. Wire it up** (see the [quick start](./collaboration.md#quick-start)):

```js
import * as Y from 'yjs';
import { WebSocketProvider }  from '@parityfox/rune-editor/collab/provider.js';   // path-style import; see note
import { bindParagraphSpike } from '@parityfox/rune-editor/collab/paragraph-binding.js';
import { bindPresence }       from '@parityfox/rune-editor/collab/presence.js';

const doc = new Y.Doc();
const provider = new WebSocketProvider('ws://localhost:1234', 'my-doc', doc);
bindParagraphSpike(editor, doc);
bindPresence(editor, doc, provider.awareness, { name: 'Alice', color: '#2563eb' });
```

> **`collab/` imports.** The package exposes the collaboration modules under
> subpaths: `rune-editor/collab/*` (e.g. `rune-editor/collab/provider.js`) and
> `rune-editor/server/*`. Inside this repo / the demo they're imported with
> relative paths (`./collab/provider.js`) instead — both are equivalent.

**No-bundler collaboration:** browsers can't resolve the bare `yjs` import, so
the demo bundles the Yjs deps into one file. Rebuild it with `npm run build:demo`
(see `examples/vendor-entry.js`) and map it in an import map — or use a CDN
(`https://esm.sh/yjs`, etc.).

---

## Verify & troubleshoot

A 30-second smoke test (with a bundler):

```js
import { Editor, Paragraph, Bold } from '@parityfox/rune-editor';
import '@parityfox/rune-editor/styles';
const ed = new Editor(document.body.appendChild(document.createElement('div')),
  { extensions: [Paragraph, Bold], content: '<p>it works</p>' });
console.log(ed.getHtml());
```

| Symptom | Fix |
|---|---|
| **No styling / unstyled toolbar** | You didn't `import '@parityfox/rune-editor/styles'` (or link `styles/rune.css`) once at your entry. |
| **`Cannot use import statement` / CJS error** | Rune is ESM-only. Use a bundler, `<script type="module">`, or Node ESM — not `require()`. |
| **Crashes during SSR / "document is not defined"** | Render client-side only (Next.js: `dynamic(..., { ssr: false })`; others: mount in `onMounted`/`onMount`). |
| **Bare specifier `rune-editor` not found in the browser** | Add an [import map](#plain-html--no-bundler) or use a bundler/CDN. |
| **React adapter `.jsx` won't transform** | Let your bundler transform `node_modules/@parityfox/rune-editor/adapters`. |
| **`Cannot find package 'yjs'`** | Install the [collaboration deps](#enabling-collaboration); for no-bundler, bundle them (`npm run build:demo`) or use a CDN. |
| **Editor not destroyed on unmount (leaks)** | Call `editor.destroy()` in your framework's teardown hook. |

More: [collaboration overview](./collaboration.md) · [API reference](./collaboration-api.md) · [server & deployment](./collaboration-server.md).
