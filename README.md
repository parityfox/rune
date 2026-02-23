# ✦ Rune

A clean, extensible rich text editor built from scratch — no Tiptap, no Slate, no ProseMirror.

Rune is **headless by design**. Every pixel is controlled via CSS custom properties, every feature is opt-in via a single config file, and every behaviour can be extended with a plain plugin object.

---

## Features

| Category | Features |
|---|---|
| **Block types** | Paragraph, Heading (H1–H3), Bullet list, Ordered list, Blockquote, Code block, Horizontal rule, Callout, Task list, Video embed, Image, Table |
| **Inline marks** | Bold, Italic, Underline, Strikethrough, Inline code, Link, Superscript, Subscript, Font size, Font family, Text colour, Text background |
| **Formatting** | Text alignment (L/C/R/Justify), Line height, Indent / Outdent |
| **Plugins** | Markdown shortcuts, Find & Replace (`⌘F`), Drag-to-reorder blocks, Format Painter |
| **UI** | Toolbar, Bubble menu, Slash menu (`/`), Tooltips |
| **Export** | `getHtml()`, `getText()`, `getMarkdown()`, `print()` |
| **Adapters** | Vanilla JS, React (`useRune` / `<RuneEditor>`), Web Component (`<rune-editor>`) |
| **DX** | Config-driven, undo/redo, dark mode, CSS custom properties, image upload hook |

---

## Installation

### npm / yarn / pnpm

```bash
npm install rune-editor
```

```bash
yarn add rune-editor
```

```bash
pnpm add rune-editor
```

Then import the stylesheet once in your app:

```js
import 'rune-editor/styles';
```

### From source (clone)

```bash
git clone https://github.com/parityfox/rune.git
cd rune
```

Serve the examples with any static file server (ES modules require HTTP):

```bash
npm run example          # uses npx serve on port 4000
# or
python3 -m http.server 4000
# open http://localhost:4000/examples/
```

---

## Usage

### Vanilla JS — config-driven (recommended)

```js
import { createFromConfig } from 'rune-editor';
import config from './rune.config.js';
import 'rune-editor/styles';

const editor = createFromConfig('#app', config, {
  content: '<p>Start writing…</p>',
  onChange(html) {
    console.log(html);
  },
});
```

### Vanilla JS — manual setup

```js
import { Editor, StarterKit } from 'rune-editor';
import 'rune-editor/styles';

const editor = new Editor('#app', {
  extensions: StarterKit,
  content: '<p>Hello world</p>',
  onChange(html) {
    console.log(html);
  },
});
```

### React

```jsx
import { RuneEditor } from 'rune-editor/react';
import config from './rune.config.js';
import 'rune-editor/styles';

export default function App() {
  return (
    <RuneEditor
      extensions={config.extensions}
      content="<p>Hello</p>"
      onChange={(html) => console.log(html)}
    />
  );
}
```

Or use the hook directly for full control:

```jsx
import { useRune } from 'rune-editor/react';
import { StarterKit } from 'rune-editor';

export default function App() {
  const { ref, editor, getHtml } = useRune({
    extensions: StarterKit,
    content: '<p>Hello</p>',
    onChange(html) { console.log(html); },
  });

  return <div ref={ref} />;
}
```

### Web Component

No framework needed — drop it straight into any HTML page.

```html
<link rel="stylesheet" href="node_modules/rune-editor/styles/rune.css">
<script type="module" src="node_modules/rune-editor/adapters/web-component/rune-editor.js"></script>

<rune-editor
  content="<p>Hello world</p>"
  placeholder="Start writing…"
></rune-editor>

<script>
  const el = document.querySelector('rune-editor');
  el.addEventListener('change', (e) => console.log(e.detail)); // e.detail = html

  // Public API
  el.getHtml();
  el.setHtml('<p>New content</p>');
  el.getMarkdown();
  el.print();
</script>
```

**Attributes:** `content`, `placeholder`, `readonly`

---

## Configuration

Edit `rune.config.js` to toggle any feature. Changes automatically propagate to the toolbar, bubble menu, slash menu, and keyboard shortcuts — no other files to touch.

```js
const config = {

  // ── Block Types ───────────────────────────────────────────
  blocks: {
    paragraph:      true,
    heading:        true,   // H1–H3
    bulletList:     true,
    orderedList:    true,
    blockquote:     true,
    codeBlock:      true,
    horizontalRule: true,
    callout:        true,   // Notion-style coloured callout box
    taskList:       true,   // Checklist with click-to-toggle checkboxes
    videoEmbed:     true,   // YouTube / Vimeo embed
    image:          true,
    table:          true,
  },

  // ── Inline Marks ──────────────────────────────────────────
  marks: {
    bold:           true,   // ⌘B
    italic:         true,   // ⌘I
    underline:      true,   // ⌘U
    strike:         true,   // ⌘⇧S
    code:           true,   // ⌘E
    link:           true,   // ⌘K
    superscript:    true,
    subscript:      true,
    fontSize:       true,   // em presets + custom px
    fontFamily:     true,
    textColor:      true,
    textBackground: true,
    textAlign:      true,   // L / C / R / Justify per block
    lineHeight:     true,   // 1.0 → 2.0
    indent:         true,
    outdent:        true,
  },

  // ── Plugins ───────────────────────────────────────────────
  plugins: {
    markdownShortcuts: true, // ## → H2, > → Blockquote, etc.
    findReplace:       true, // ⌘F floating panel
    dragReorder:       true, // drag handle in left gutter
    formatPainter:     true, // copy & paste formatting
  },

  // ── Toolbar ───────────────────────────────────────────────
  toolbar: {
    enabled: true,
    items: [
      'bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', '|',
      'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote',
      'codeBlock', 'horizontalRule', '|',
      'callout', 'videoEmbed', 'image', 'table', '|',
      'fontFamily', 'fontSize', 'textColor', 'textBackground', '|',
      'textAlign', 'lineHeight', '|',
      'outdent', 'indent', '|',
      'link', 'code', '|',
      'clearFormat', 'formatPainter',
    ],
  },

  // ── Bubble Menu ───────────────────────────────────────────
  bubbleMenu: {
    enabled: true,
    items: ['bold', 'italic', 'underline', 'strike',
            'superscript', 'subscript', '|',
            'textColor', 'textBackground', '|', 'link'],
  },

  // ── Slash Menu ────────────────────────────────────────────
  slashMenu: { enabled: true },

  // ── Editor Behaviour ──────────────────────────────────────
  editor: {
    placeholder: "Write something, or type '/' for commands…",
    spellcheck:  true,
    autofocus:   false,
    readOnly:    false,

    // Optional image upload hook — prevents base64 bloat.
    // Receives a File, must return Promise<string> (the hosted URL).
    // uploadImage: (file) => fetch('/upload', { method: 'POST', body: ... })
    //                          .then(r => r.json()).then(d => d.url),
  },

  // ── History ───────────────────────────────────────────────
  history: {
    enabled:  true,
    maxSteps: 100,
  },
};

export default config;
```

---

## API

```js
// Commands
editor.cmd('toggleBold')
editor.cmd('setTextColor', '#e03e3e')
editor.chain().toggleBold().toggleItalic().run()

// Content
editor.getHtml()           // → HTML string
editor.setHtml('<p>…</p>')
editor.getText()           // → plain text
editor.getMarkdown()       // → Markdown string
editor.isEmpty()           // → boolean

// Print
editor.print()             // opens print dialog with clean styles

// State
editor.focus()
editor.blur()
editor.enable()
editor.disable()
editor.destroy()

// Events
editor.events.on('change',          ({ html }) => { … })
editor.events.on('selectionchange', () => { … })
editor.events.on('keydown',         ({ event }) => { … })
editor.events.on('paste',           ({ event }) => { … })
```

### Image upload hook

Prevents base64 data URLs from bloating your HTML. Images show a base64 preview instantly while the upload completes in the background, then the src is swapped.

```js
const editor = createFromConfig('#app', config, {
  uploadImage(file) {
    const form = new FormData();
    form.append('file', file);
    return fetch('/api/upload', { method: 'POST', body: form })
      .then(r => r.json())
      .then(d => d.url);  // must resolve to a URL string
  },
});
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘B` | Bold |
| `⌘I` | Italic |
| `⌘U` | Underline |
| `⌘⇧S` | Strikethrough |
| `⌘E` | Inline code |
| `⌘K` | Insert / edit link |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `⌘F` | Find & Replace |
| `/` | Slash command menu |
| `Tab` | Indent list / next table cell |
| `⇧Tab` | Outdent list / prev table cell |

---

## Markdown Shortcuts

Type these at the start of a line and press `Space` or `Enter`:

| Type | Result |
|---|---|
| `# ` | Heading 1 |
| `## ` | Heading 2 |
| `### ` | Heading 3 |
| `- ` or `* ` | Bullet list |
| `1. ` | Ordered list |
| `> ` | Blockquote |
| ` ``` ` | Code block |
| `---` | Horizontal rule |

Inline shortcuts (wrap text and press `Space`):

| Type | Result |
|---|---|
| `**text**` or `__text__` | **Bold** |
| `*text*` or `_text_` | *Italic* |
| `` `code` `` | `Inline code` |

---

## Theming

All colours, sizes, and typography are CSS custom properties. Override any of them on `:root`:

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

## Writing Custom Extensions

### Block extension

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

  toolbarItem: {
    name:     'myBlock',
    icon:     '<svg>…</svg>',
    title:    'My Block',
    action:   'insertMyBlock',
    isActive: (editor) => editor.isActive('myBlock'),
  },

  slashItem: {
    icon:        '▦',
    title:       'My Block',
    description: 'Insert a custom block',
    action:      (editor) => editor.cmd('insertMyBlock'),
  },
};
```

### Mark extension

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

### Plugin extension

```js
export const MyPlugin = {
  name: 'myPlugin',
  type: 'plugin',

  init(editor) {
    editor.content.addEventListener('keydown', (e) => {
      // … handle keys, attach behaviours, etc.
    });
  },

  commands(editor) {
    return {
      myPluginCommand: () => { /* … */ },
    };
  },

  // Plugins can also expose a toolbar button
  toolbarItem: {
    name:     'myPlugin',
    icon:     '<svg>…</svg>',
    title:    'My Plugin',
    action:   'myPluginCommand',
    isActive: (editor) => false,
  },
};
```

---

## Project Structure

```
rune/
├── src/
│   ├── core/
│   │   ├── Editor.js          main editor class
│   │   ├── Schema.js          extension registry
│   │   ├── Commands.js        command registry + chainable API
│   │   ├── EventBus.js        pub/sub
│   │   ├── History.js         undo/redo
│   │   └── Selection.js       caret/selection helpers
│   ├── extensions/
│   │   ├── blocks/            Paragraph, Heading, BulletList, OrderedList,
│   │   │                      Blockquote, CodeBlock, HorizontalRule,
│   │   │                      Callout, TaskList, VideoEmbed, Image, Table
│   │   ├── marks/             Bold, Italic, Underline, Strike, Code, Link,
│   │   │                      Superscript, Subscript, FontSize, FontFamily,
│   │   │                      TextColor, TextBackground
│   │   ├── formatting/        TextAlign, LineHeight, Indent, Outdent
│   │   ├── plugins/           MarkdownShortcuts, FindReplace,
│   │   │                      DragReorder, FormatPainter
│   │   └── index.js           named exports + StarterKit bundle
│   ├── ui/
│   │   ├── Toolbar.js
│   │   ├── BubbleMenu.js
│   │   └── SlashMenu.js
│   ├── utils/
│   │   ├── dom.js
│   │   ├── html.js
│   │   ├── id.js
│   │   └── markdown.js        HTML → Markdown converter
│   ├── createFromConfig.js    factory for rune.config.js
│   └── index.js               main entry point
├── adapters/
│   ├── react/
│   │   ├── useRune.js
│   │   ├── RuneEditor.jsx
│   │   └── index.js
│   └── web-component/
│       └── rune-editor.js     <rune-editor> custom element
├── styles/
│   └── rune.css
├── examples/
│   └── index.html
├── rune.config.js
├── package.json
└── README.md
```

---

## License

MIT
