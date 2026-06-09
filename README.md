<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/npm/@parityfox/rune-editor@1.0.1/assets/rune-wordmark-bone.png">
  <img alt="Rune" src="https://cdn.jsdelivr.net/npm/@parityfox/rune-editor@1.0.1/assets/rune-wordmark-ink.png" width="200">
</picture>

**A headless WYSIWYG editor — what you write is what you get.**

[![npm version](https://img.shields.io/npm/v/@parityfox/rune-editor?style=flat-square&color=2383e2&label=npm)](https://www.npmjs.com/package/@parityfox/rune-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)
[![Zero dependencies](https://img.shields.io/badge/dependencies-zero-blue?style=flat-square)](package.json)
[![Vanilla JS](https://img.shields.io/badge/built%20with-Vanilla%20JS-f7df1e?style=flat-square&logo=javascript&logoColor=black)](src/)

[**Getting Started**](#-installation) · [**Live Demo**](#-quick-start) · [**API Docs**](#-api) · [**Contribute**](CONTRIBUTING.md)

</div>

---

## ✦ Why Rune?

Most rich text editors are either too heavy (ProseMirror, Slate) or too opinionated (Quill). Rune sits in the middle — a **zero-dependency**, headless editor that gives you full control.

- 🏗 **No framework required** — works with Vanilla JS, React, or as a Web Component
- 🎛 **Config-driven** — enable/disable every feature from a single `rune.config.js`
- 🎨 **Headless by design** — 100% of styling via CSS custom properties
- 🔌 **Extension system** — add custom blocks, marks, and plugins with a plain object
- 🔒 **Security-first** — sanitized paste, blocked `javascript:` URLs, safe HTML output
- ⚡ **Lightweight** — no build step, no bundler required

---

## 📦 Installation

```bash
# npm
npm install @parityfox/rune-editor

# yarn
yarn add @parityfox/rune-editor

# pnpm
pnpm add @parityfox/rune-editor
```

Import the stylesheet once in your app entry point:

```js
import '@parityfox/rune-editor/styles';
```

> **From source:** clone the repo and open `examples/index.html` with any static server (`npx serve . -p 4000`).

📦 **Setting up a specific stack?** See the **[Installation & Setup guide](./docs/installation.md)** — Vite/webpack/Rollup/esbuild, plain HTML (no bundler), React/Next.js, Vue, Svelte, Angular, the web component, plus the collaboration setup process and troubleshooting.

---

## ⚡ Quick Start

### Vanilla JS (recommended)

```js
import { createFromConfig } from '@parityfox/rune-editor';
import config from './rune.config.js';
import '@parityfox/rune-editor/styles';

const editor = createFromConfig('#app', config, {
  content: '<p>Start writing…</p>',
  onChange(html) { console.log(html); },
});
```

### React

```jsx
import { RuneEditor } from '@parityfox/rune-editor/react';
import { StarterKit } from '@parityfox/rune-editor';
import '@parityfox/rune-editor/styles';

export default function App() {
  return (
    <RuneEditor
      extensions={StarterKit}
      content="<p>Hello</p>"
      onChange={(html) => console.log(html)}
    />
  );
}
```

> **Next.js / SSR:** the editor is browser-only (it touches the DOM on mount).
> In the App Router, render it from a Client Component (`'use client'`) or load
> it with `next/dynamic` and `{ ssr: false }`:
>
> ```jsx
> import dynamic from 'next/dynamic';
> const RuneEditor = dynamic(
>   () => import('@parityfox/rune-editor/react').then((m) => m.RuneEditor),
>   { ssr: false }
> );
> ```

### Web Component

```html
<link rel="stylesheet" href="node_modules/@parityfox/rune-editor/styles/rune.css">
<script type="module" src="node_modules/@parityfox/rune-editor/adapters/web-component/rune-editor.js"></script>

<rune-editor content="<p>Hello world</p>" placeholder="Start writing…"></rune-editor>

<script>
  document.querySelector('rune-editor').addEventListener('change', (e) => {
    console.log(e.detail); // html string
  });
</script>
```

---

## ✨ Features

### 🧱 Block Types

| Block | Tag | Slash Command |
|---|---|---|
| Paragraph | `<p>` | — |
| Heading | `<h1>` – `<h3>` | `/h1` `/h2` `/h3` |
| Bullet List | `<ul>` | `/bullet` |
| Ordered List | `<ol>` | `/ordered` |
| Blockquote | `<blockquote>` | `/quote` |
| Code Block | `<pre><code>` | `/code` |
| Horizontal Rule | `<hr>` | `/divider` |
| Callout | custom `<div>` | `/callout` |
| Task List | `<ul data-type>` | `/task` |
| Video Embed | `<figure>` iframe | `/video` |
| Image | `<figure><img>` | `/image` |
| Table | `<table>` | `/table` |

### ✍️ Inline Marks

`Bold` · `Italic` · `Underline` · `Strikethrough` · `Inline Code` · `Link` · `Superscript` · `Subscript` · `Font Size` · `Font Family` · `Text Color` · `Text Background`

### 🎛 Formatting

`Text Alignment` · `Line Height` · `Indent` · `Outdent`

### 🔌 Plugins

| Plugin | Trigger | Description |
|---|---|---|
| Markdown Shortcuts | `# ` `> ` `- ` etc. | Converts Markdown syntax on the fly |
| Find & Replace | `⌘F` | Floating panel with regex support |
| Drag to Reorder | Drag handle `⠿` | Reorder any block by dragging |
| Format Painter | Toolbar `🖌` | Copy & paste formatting between selections |

### 📤 Export

```js
editor.getHtml()        // → sanitized HTML string
editor.getText()        // → plain text
editor.getMarkdown()    // → Markdown string
editor.setMarkdown(md)  // ← replace content from Markdown
editor.insertMarkdown(md)// ← insert Markdown at the caret
editor.print()          // → opens clean print dialog
```

Markdown-looking text is also converted automatically on paste (disable with
`pasteMarkdown: false`). `markdownToHtml(md)` is exported for DOM-free use.

---

## ⚙️ Configuration

All features are toggled from `rune.config.js`. A change here automatically updates the toolbar, bubble menu, slash menu, and keyboard shortcuts — no other files need editing.

```js
// rune.config.js
const config = {

  blocks: {
    paragraph:      true,
    heading:        true,   // H1–H3
    bulletList:     true,
    orderedList:    true,
    blockquote:     true,
    codeBlock:      true,
    horizontalRule: true,
    callout:        true,
    taskList:       true,
    videoEmbed:     true,
    image:          true,
    table:          true,
  },

  marks: {
    bold:           true,   // ⌘B
    italic:         true,   // ⌘I
    underline:      true,   // ⌘U
    strike:         true,   // ⌘⇧S
    code:           true,   // ⌘E
    link:           true,   // ⌘K
    superscript:    true,
    subscript:      true,
    fontSize:       true,
    fontFamily:     true,
    textColor:      true,
    textBackground: true,
  },

  formatting: {
    textAlign:      true,
    lineHeight:     true,
    indent:         true,
    outdent:        true,
    clearFormat:    true,
  },

  plugins: {
    markdownShortcuts: true,
    findReplace:       true,
    dragReorder:       true,
    formatPainter:     true,
  },

  toolbar: {
    enabled: true,
    items: [
      'bold', 'italic', 'underline', 'strike', '|',
      'heading', 'bulletList', 'orderedList', '|',
      'link', 'image', 'table', '|',
      'clearFormat', 'formatPainter',
    ],
  },

  bubbleMenu: {
    enabled: true,
    items: ['bold', 'italic', 'underline', 'strike', '|', 'link'],
  },

  editor: {
    placeholder: "Write something, or type '/' for commands…",
    spellcheck:  true,
    autofocus:   false,
    readOnly:    false,
    // uploadImage: (file) => fetch('/api/upload', { method: 'POST', body: formData })
    //                          .then(r => r.json()).then(d => d.url),
  },

  history: {
    enabled:  true,
    maxSteps: 100,
  },
};

export default config;
```

---

## 📖 API

### Content

```js
editor.getHtml()            // → HTML string
editor.setHtml('<p>…</p>') // set content
editor.getText()            // → plain text
editor.getMarkdown()        // → Markdown string
editor.isEmpty()            // → boolean
```

### Commands

```js
editor.cmd('toggleBold')
editor.cmd('setTextColor', '#e03e3e')
editor.cmd('insertBlock', 'callout')

// Chainable API
editor.chain().toggleBold().toggleItalic().run()
```

### State

```js
editor.focus()
editor.blur()
editor.enable()
editor.disable()
editor.isActive('bold')    // → boolean
editor.destroy()
```

### Events

```js
editor.events.on('change',          ({ html }) => { … })
editor.events.on('selectionchange', ({ editor }) => { … })
editor.events.on('keydown',         ({ event }) => { … })
editor.events.on('paste',           ({ editor }) => { … })
```

---

## ⌨️ Keyboard Shortcuts

| Mac | Windows | Action |
|---|---|---|
| `⌘B` | `Ctrl+B` | Bold |
| `⌘I` | `Ctrl+I` | Italic |
| `⌘U` | `Ctrl+U` | Underline |
| `⌘⇧S` | `Ctrl+Shift+S` | Strikethrough |
| `⌘E` | `Ctrl+E` | Inline code |
| `⌘K` | `Ctrl+K` | Insert / edit link |
| `⌘Z` | `Ctrl+Z` | Undo |
| `⌘⇧Z` | `Ctrl+Shift+Z` | Redo |
| `⌘F` | `Ctrl+F` | Find & Replace |
| `/` | `/` | Slash command menu |

---

## 📝 Markdown Shortcuts

Type at the start of a line followed by `Space`:

| Input | Result |
|---|---|
| `# ` | Heading 1 |
| `## ` | Heading 2 |
| `### ` | Heading 3 |
| `- ` or `* ` | Bullet list |
| `1. ` | Ordered list |
| `> ` | Blockquote |
| ` ``` ` | Code block |
| `---` | Horizontal rule |

Inline (wrap text):

| Input | Result |
|---|---|
| `**text**` | **Bold** |
| `*text*` | *Italic* |
| `` `code` `` | `Code` |

---

## 🎨 Theming

All colours, sizes, and typography are CSS custom properties. Override on `:root`:

```css
:root {
  --rune-color-bg:        #ffffff;
  --rune-color-fg:        #1a1a1a;
  --rune-color-muted:     #9b9b9b;
  --rune-color-border:    #e9e9e7;
  --rune-color-accent:    #2383e2;
  --rune-color-surface:   #f7f7f5;
  --rune-color-hover:     #f1f1ef;
  --rune-color-active-bg: #e8f0fc;
  --rune-color-active-fg: #2383e2;

  --rune-font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  --rune-font-mono:   'JetBrains Mono', ui-monospace, monospace;
  --rune-font-size:   16px;
  --rune-line-height: 1.75;

  --rune-radius:    6px;
  --rune-radius-lg: 10px;
}
```

**Dark mode** — add `data-theme="dark"` to `<html>` or any ancestor:

```js
document.documentElement.dataset.theme = 'dark';
```

---

## 🔌 Writing Extensions

<details>
<summary><strong>Block extension</strong></summary>

```js
export const MyBlock = {
  name: 'myBlock',
  type: 'block',
  tag:  'div',

  commands(editor) {
    return {
      insertMyBlock: () => editor.cmd('insertBlock', 'myBlock'),
    };
  },

  slashItem: {
    icon:        '▦',
    title:       'My Block',
    description: 'Insert a custom block',
    action:      (editor) => editor.cmd('insertMyBlock'),
  },

  toolbarItem: {
    name:     'myBlock',
    icon:     '<svg>…</svg>',
    title:    'My Block',
    action:   'insertMyBlock',
    isActive: (editor) => editor.isActive('myBlock'),
  },
};
```
</details>

<details>
<summary><strong>Mark extension</strong></summary>

```js
export const MyMark = {
  name: 'myMark',
  type: 'mark',
  tag:  'span',

  commands(editor) {
    return {
      toggleMyMark: () => document.execCommand('…'),
    };
  },

  keymap: {
    'Meta+m':    (editor) => editor.cmd('toggleMyMark'),
    'Control+m': (editor) => editor.cmd('toggleMyMark'),
  },

  toolbarItem: {
    name:     'myMark',
    icon:     '<svg>…</svg>',
    title:    'My Mark',
    action:   'toggleMyMark',
    isActive: (editor) => document.queryCommandState('…'),
  },
};
```
</details>

<details>
<summary><strong>Plugin extension</strong></summary>

```js
export const MyPlugin = {
  name: 'myPlugin',
  type: 'plugin',

  init(editor) {
    editor.content.addEventListener('keydown', (e) => {
      // handle keys, attach behaviours, etc.
    });
  },

  commands(editor) {
    return {
      myCommand: () => { /* … */ },
    };
  },
};
```
</details>

---

## 🤝 Collaborative Editing

Opt-in real-time collaboration (Yjs-based) lives in `collab/`. Multiple users
edit the same document — over a network or in-process — with **live presence**
(cursors, selection highlights, typing), **comments**, **tracked-change
suggestions**, **offline persistence**, and full block coverage (incl.
per-cell tables and callout bodies). The core editor stays dependency-free; the
collab layer's deps (Yjs, ws, y-websocket, y-indexeddb) are dev/server-only.

```js
import * as Y from 'yjs';
import { WebSocketProvider, collab } from '@parityfox/rune-editor/collab';

const provider = new WebSocketProvider('wss://your-host', 'my-doc', new Y.Doc());

const session = collab(editor, provider, {
  user: { name: 'Alice', color: '#2563eb' },
  presence: true,      // remote cursors + typing labels
  comments: true,      // threaded comments  → session.comments (CommentStore)
  suggestions: true,   // tracked changes    → session.suggestions (SuggestionStore)
});
// session.setSuggesting(true) to record edits as suggestions
// session.destroy()  — also runs automatically on editor.destroy()
```

> The individual binders (`bindParagraph`, `bindPresence`, `CommentStore`,
> `SuggestionStore`, `persistLocally`, …) are still exported from
> `@parityfox/rune-editor/collab` if you want to wire features by hand.

Try the live two-pane demo: `npm run collab-server` then open
`/examples/collab` (also runs in-process from static files).

📚 **Full documentation:**

- **[Collaboration overview](./docs/collaboration.md)** — architecture, the document model, every feature, testing, limitations
- **[API reference](./docs/collaboration-api.md)** — all `collab/` modules with signatures + examples
- **[Server & deployment](./docs/collaboration-server.md)** — reference server, `authorize()` auth hook, persistence, production

## 🗂 Project Structure

```
rune/
├── src/
│   ├── core/
│   │   ├── Editor.js          ← main editor class
│   │   ├── Schema.js          ← extension registry
│   │   ├── Commands.js        ← command registry + chainable API
│   │   ├── EventBus.js        ← pub/sub
│   │   ├── History.js         ← undo/redo
│   │   └── Selection.js       ← caret/selection helpers
│   ├── extensions/
│   │   ├── blocks/            ← Paragraph, Heading, BulletList, …
│   │   ├── marks/             ← Bold, Italic, Link, FontSize, …
│   │   ├── formatting/        ← TextAlign, LineHeight, Indent, Outdent
│   │   └── plugins/           ← MarkdownShortcuts, FindReplace, DragReorder, FormatPainter
│   ├── ui/
│   │   ├── Toolbar.js
│   │   ├── BubbleMenu.js
│   │   └── SlashMenu.js
│   ├── utils/
│   │   ├── dom.js
│   │   ├── html.js            ← sanitize, normalizeHtml
│   │   ├── id.js
│   │   └── markdown.js        ← HTML → Markdown converter
│   └── createFromConfig.js    ← factory for rune.config.js
├── adapters/
│   ├── react/                 ← useRune hook + RuneEditor component
│   └── web-component/         ← <rune-editor> custom element
├── collab/                    ← collaborative editing (Yjs) — see docs/
│   ├── provider.js            ← WebSocketProvider (networked transport)
│   ├── memory-hub.js          ← in-process transport (demos/tests)
│   ├── paragraph-binding.js   ← Yjs Doc ⇄ editor DOM binding
│   ├── schema.js              ← declarative DOM ⇄ model mapping
│   ├── presence.js            ← remote cursors, selections, typing
│   ├── comments.js + comments-ui.js
│   ├── suggestions.js + suggestion-mode.js
│   └── providers/indexeddb.js ← local-first persistence
├── server/
│   └── collab-server.mjs      ← reference Yjs sync server (npm run collab-server)
├── docs/                      ← in-depth guides (collaboration, API, server)
├── styles/
│   └── rune.css
├── examples/
│   ├── index.html
│   └── collab.html            ← two-pane collaboration demo
├── tests/                     ← Vitest unit + tests/e2e (Playwright)
├── rune.config.js             ← feature flags (edit this!)
└── package.json
```

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

---

## 🔒 Security

Found a vulnerability? Please read our [Security Policy](SECURITY.md) and report privately — do **not** open a public issue.

---

## 📄 License

[MIT](LICENSE) © [ParityFox](https://parityfox.com)

Rune is free and MIT-licensed — use it anywhere, commercially too. If it's useful
to you, a ⭐ on GitHub or a mention is genuinely appreciated 🙏. By default the
editor shows a small **“Made with Rune”** credit linking to
[parityfox.com](https://parityfox.com); you can remove it any time with
`attribution: false` (Editor option / `<rune-editor attribution="false">` /
`editor.attribution` in `rune.config.js`).
