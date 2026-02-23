# ✦ Rune

A clean, extensible rich text editor built from scratch — no Tiptap, no Slate, no ProseMirror.

Rune is **headless by design**. Every pixel is controlled via CSS custom properties, every feature is opt-in via a single config file, and every behaviour can be extended with a simple plugin object.

---

## Features

- **Zero dependencies** — pure vanilla JS, works in any framework
- **Extension system** — blocks, marks, and plugins as plain objects
- **Config-driven** — one file to enable/disable any feature
- **Body-appended popups** — toolbars and pickers never get clipped
- **Slash menu** — Notion-style `/` command palette
- **Bubble menu** — floating toolbar on text selection
- **Full theming** — CSS custom properties + built-in dark mode
- **React adapter** — `useRune` hook and `<RuneEditor>` component
- **History** — undo/redo with configurable depth

---

## Quick Start

Serve with any static file server (ES modules require HTTP):

```bash
# from the rune directory
python3 -m http.server 4000
# open http://localhost:4000/examples/
```

---

## Usage

### Vanilla JS

```js
import { Editor } from './src/core/Editor.js';
import { StarterKit } from './src/extensions/index.js';

const editor = new Editor('#app', {
  extensions: StarterKit,
  content: '<p>Hello world</p>',
  onChange(html) {
    console.log(html);
  },
});
```

### Config-driven (recommended)

```js
import { createFromConfig } from './src/createFromConfig.js';
import config from './rune.config.js';

const editor = createFromConfig('#app', config, {
  content: '<p>Start writing…</p>',
  onChange(html) { console.log(html); },
});
```

### React

```jsx
import { RuneEditor } from './adapters/react/index.js';

export default function App() {
  return (
    <RuneEditor
      config={config}
      content="<p>Hello</p>"
      onChange={(html) => console.log(html)}
    />
  );
}
```

---

## Configuration

Edit `rune.config.js` to toggle any feature. Changes automatically propagate to the toolbar, bubble menu, slash menu, and keyboard shortcuts.

```js
const config = {

  blocks: {
    paragraph:      true,
    heading:        true,   // H1–H3
    bulletList:     true,
    orderedList:    true,
    blockquote:     true,
    codeBlock:      true,
    horizontalRule: true,
    image:          true,
  },

  marks: {
    bold:           true,   // ⌘B
    italic:         true,   // ⌘I
    underline:      true,   // ⌘U
    strike:         true,
    code:           true,
    link:           true,   // ⌘K
    superscript:    true,
    subscript:      true,
    fontSize:       true,   // em + custom px
    fontFamily:     true,
    textColor:      true,
    textBackground: true,
  },

  toolbar: {
    enabled: true,
    items: [
      'bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', '|',
      'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule', '|',
      'fontFamily', 'fontSize', 'textColor', 'textBackground', '|',
      'link', 'code', 'image', '|',
      'clearFormat',
    ],
  },

  bubbleMenu: {
    enabled: true,
    items: ['bold', 'italic', 'underline', 'strike', '|', 'textColor', 'textBackground', '|', 'link'],
  },

  slashMenu: { enabled: true },

  editor: {
    placeholder: "Write something, or type '/' for commands…",
    spellcheck:  true,
    autofocus:   false,
    readOnly:    false,
  },

  history: {
    enabled:  true,
    maxSteps: 100,
  },
};
```

---

## Extensions

Each extension is a plain object. Register it by passing it to the `extensions` array.

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
    name:   'myBlock',
    icon:   '<svg>…</svg>',
    title:  'My Block',
    action: 'insertMyBlock',
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
    isActive: (editor) => { /* … */ },
  },
};
```

### Panel toolbar item (colour pickers, font pickers, etc.)

```js
toolbarItem: {
  name: 'myPicker',
  type: 'panel',          // opens a floating popup instead of firing an action
  icon: '<svg>…</svg>',
  title: 'My Picker',
  indicator: true,        // shows a colour bar under the icon
  defaultColor: '#000',

  renderPanel(editor, close, item) {
    // Save selection — it may be lost when panel content is interacted with
    let savedRange = null;
    const sel = window.getSelection();
    if (sel?.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();

    const wrap = document.createElement('div');
    // … build panel DOM …
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (savedRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
      editor.cmd('myCommand', value);
      close();
    });
    return wrap;
  },
}
```

---

## API

```js
editor.cmd('toggleBold')             // execute a command by name
editor.chain().toggleBold().run()    // chainable commands

editor.getHtml()                     // → string
editor.setHtml('<p>Hello</p>')
editor.getText()                     // → plain text
editor.isEmpty()                     // → boolean

editor.focus()
editor.blur()
editor.enable()
editor.disable()
editor.destroy()

editor.on = editor.events.on         // subscribe to events
// Events: 'change', 'selectionchange', 'keydown', 'paste'
```

---

## Theming

All colours, sizes, and shadows are CSS custom properties on `:root`. Override any of them:

```css
:root {
  --rune-color-bg:           #ffffff;
  --rune-color-fg:           #1a1a1a;
  --rune-color-muted:        #9b9b9b;
  --rune-color-border:       #e9e9e7;
  --rune-color-accent:       #2383e2;
  --rune-color-surface:      #f7f7f5;
  --rune-color-hover:        #f1f1ef;
  --rune-color-active-bg:    #e8f0fc;
  --rune-color-active-fg:    #2383e2;

  --rune-font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  --rune-font-mono:   'JetBrains Mono', ui-monospace, monospace;
  --rune-font-size:   16px;
  --rune-line-height: 1.75;

  --rune-radius:    6px;
  --rune-radius-lg: 10px;

  --rune-toolbar-height:   40px;
  --rune-toolbar-btn-size: 30px;
}
```

**Dark mode** — add `data-theme="dark"` to `<html>` or any ancestor:

```js
document.documentElement.dataset.theme = 'dark';
```

---

## Project Structure

```
rune/
├── src/
│   ├── core/
│   │   ├── Editor.js          # main editor class
│   │   ├── Schema.js          # extension registry
│   │   ├── Commands.js        # command registry + chainable API
│   │   ├── EventBus.js        # pub/sub
│   │   ├── History.js         # undo/redo
│   │   └── Selection.js       # caret/selection helpers
│   ├── extensions/
│   │   ├── blocks/            # Paragraph, Heading, Lists, Blockquote, CodeBlock, HR, Image
│   │   ├── marks/             # Bold, Italic, Underline, Strike, Code, Link,
│   │   │                      # Superscript, Subscript, FontSize, FontFamily,
│   │   │                      # TextColor, TextBackground
│   │   └── index.js           # named exports + StarterKit bundle
│   ├── ui/
│   │   ├── Toolbar.js
│   │   ├── BubbleMenu.js
│   │   └── SlashMenu.js
│   ├── utils/
│   │   ├── dom.js
│   │   ├── html.js
│   │   └── id.js
│   ├── createFromConfig.js    # factory for rune.config.js
│   └── index.js               # main entry point
├── adapters/
│   └── react/
│       ├── useRune.js
│       ├── RuneEditor.jsx
│       └── index.js
├── styles/
│   └── rune.css
├── examples/
│   └── index.html
├── rune.config.js
├── package.json
└── TODO.md
```

---

## Roadmap

See [TODO.md](./TODO.md) for the full feature roadmap, including:

- Callout blocks, Task lists, Video embed, Table
- Text alignment, Markdown shortcuts
- Find & Replace, Drag to reorder blocks
- Vue adapter, Web Component, Markdown export

---

## License

MIT
