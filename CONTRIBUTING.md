<div align="center">

# 🤝 Contributing to Rune

Thank you for taking the time to contribute! Every bug report, feature idea, and pull request makes Rune better for everyone.

</div>

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Writing Extensions](#writing-extensions)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Coding Standards](#coding-standards)
- [Commit Style](#commit-style)

---

## 📜 Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Please report unacceptable behaviour to the maintainers.

---

## 💡 Ways to Contribute

| Type | How |
|---|---|
| 🐛 **Bug report** | [Open an issue](../../issues/new?template=bug_report.md) with steps to reproduce |
| 💬 **Feature request** | [Open an issue](../../issues/new?template=feature_request.md) and describe the use case |
| 📖 **Documentation** | Fix typos, improve examples, add clarity |
| 🔌 **New extension** | Propose first via an issue — then open a PR |
| 🧹 **Refactoring** | Keep scope small; link to the issue it addresses |
| ✅ **Bug fix** | Reference the issue number in your PR description |

> **Before starting large work** — open an issue first to discuss the approach. This avoids duplicate effort and ensures alignment with the project direction.

---

## 🛠 Development Setup

Rune has **zero build step** and **zero runtime dependencies**. All you need is a browser and a static file server.

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/rune.git
cd rune

# 2. Start the dev server (uses npx serve, no install needed)
npm run example
# → open http://localhost:4000/examples/

# 3. Edit source files — the browser reloads on save
#    (use a live-reload server like VS Code Live Server for HMR)
```

**No transpilation, no bundler, no TypeScript compile step.** Edit a `.js` file, refresh the browser, see the result.

---

## 🗂 Project Structure

```
src/
├── core/           # Editor engine — touch with care
│   ├── Editor.js   # Main class, public API
│   ├── Schema.js   # Extension registry
│   ├── Commands.js # Command registry + chainable API
│   ├── History.js  # Undo/redo stack
│   └── Selection.js
├── extensions/
│   ├── blocks/     # Block-level nodes (Paragraph, Heading, …)
│   ├── marks/      # Inline marks (Bold, Link, FontSize, …)
│   ├── formatting/ # TextAlign, LineHeight, Indent, Outdent
│   └── plugins/    # Behavioural plugins (DragReorder, FindReplace, …)
├── ui/             # Toolbar, BubbleMenu, SlashMenu
└── utils/          # dom.js, html.js, markdown.js, id.js
```

**Rule of thumb:** new features almost always belong in `src/extensions/`. Only touch `src/core/` if the feature genuinely requires engine-level changes.

---

## 🔌 Writing Extensions

Extensions are plain objects — no classes, no inheritance. There are three types:

### Block

```js
export const MyBlock = {
  name: 'myBlock',   // unique identifier
  type: 'block',
  tag:  'div',       // or ['div', 'section'] for multiple tags

  commands(editor) {
    return {
      insertMyBlock: () => editor.cmd('insertBlock', 'myBlock'),
    };
  },

  slashItem: {
    icon:        '▦',
    title:       'My Block',
    description: 'A short description shown in the slash menu',
    action:      (editor) => editor.cmd('insertMyBlock'),
  },

  toolbarItem: {
    name:     'myBlock',
    icon:     '<svg>…</svg>',   // raw SVG string
    title:    'My Block (tooltip)',
    action:   'insertMyBlock',
    isActive: (editor) => editor.isActive('myBlock'),
  },
};
```

### Mark

```js
export const MyMark = {
  name: 'myMark',
  type: 'mark',
  tag:  'span',

  commands(editor) {
    return {
      toggleMyMark: () => document.execCommand('bold'), // or custom logic
    };
  },

  keymap: {
    'Meta+m':    (editor) => editor.cmd('toggleMyMark'),
    'Control+m': (editor) => editor.cmd('toggleMyMark'),
  },

  toolbarItem: { /* same shape as block */ },
};
```

### Plugin

```js
export const MyPlugin = {
  name: 'myPlugin',
  type: 'plugin',

  init(editor) {
    // Called once when the editor mounts
    editor.events.on('keydown', ({ event }) => { … });
  },

  commands(editor) {
    return { myCommand: () => { … } };
  },
};
```

---

## 📬 Submitting a Pull Request

1. **Fork** the repository and create a branch: `git checkout -b feat/my-feature`
2. **Make your changes** — keep commits small and focused
3. **Test manually** in the example page across Chrome, Firefox, and Safari if possible
4. **Push** to your fork and **open a PR** against `main`
5. Fill in the PR template — link the related issue, describe what changed and why

### PR checklist

- [ ] Tested in at least one modern browser
- [ ] No new `console.log` statements left in
- [ ] No new runtime dependencies added
- [ ] `rune.config.js` updated if a new feature flag is needed
- [ ] README updated if the public API changed

---

## 🧹 Coding Standards

- **Vanilla ES2020+** — no TypeScript, no JSX outside the React adapter
- **No dependencies** — if you think you need one, open a discussion first
- **No build step** — code must run directly in the browser as ES modules
- **Prefer `el()` from `utils/dom.js`** for DOM creation over raw `document.createElement`
- **Sanitize any user-supplied HTML** via `sanitize()` from `utils/html.js` before insertion
- **Block all dangerous URLs** — check `javascript:`, `vbscript:`, `data:text/html` on any `href`/`src`
- Keep functions **short and focused** — if a method exceeds ~40 lines, consider splitting it

---

## ✏️ Commit Style

We use a lightweight prefix convention:

| Prefix | When to use |
|---|---|
| `feat:` | New feature or extension |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `refactor:` | Code change with no behaviour change |
| `style:` | Formatting, whitespace (no logic change) |
| `chore:` | Build scripts, config, repo maintenance |

**Examples:**
```
feat: add Toggle/Accordion block extension
fix: prevent slash menu from opening inside code blocks
docs: add Web Component usage to README
refactor: extract _applyInlineStyle helper in FormatPainter
```

---

## ❓ Questions?

Open a [Discussion](../../discussions) or drop a comment on the relevant issue. We're happy to help.

---

*Thank you for making Rune better!* ✦
