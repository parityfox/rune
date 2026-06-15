# 📋 Changelog

All notable changes to Rune are documented here.

This project adheres to [Semantic Versioning](https://semver.org/). Dates follow `YYYY-MM-DD`.

---

## [1.2.0] — 2026-06-15

### ✨ Added

- **Inline emoji picker** — a toolbar `🙂` button opens a categorized picker and inserts the chosen emoji **inline at the caret** (headings, paragraphs, lists, callout bodies). Complements the existing `:shortcode:` autocomplete. Enable via `plugins.emoji` and place with the `emoji` toolbar item.

### 🐛 Fixed

- Inserting a callout from the `/` menu no longer drops the caret into a paragraph below the (empty) callout — the Enter that picked the item was leaking into the callout's own Enter handler and exiting it
- Selecting a `:shortcode:` emoji inside a callout body no longer appends a stray blank line

### 🔒 Security

- Bumped `esbuild` to `0.28.1`, clearing GHSA-gv7w-rqvm-qjhr (high) and GHSA-g7r4-m6w7-qqqr (low). `esbuild` is a devDependency used only by `build:demo` and is not shipped, so published-package consumers were never affected

### 📝 Docs

- Documented the **Emoji & Icons** feature and added `emoji` to the example config
- Pointed the **Live Playground** links at `https://runeditor.com`

---

## [1.1.1] — 2026-06-10

### 📝 Docs

- Fixed the no-bundler / CDN install instructions: use the full scoped, version-pinned package name (`@parityfox/rune-editor@1.1.1`) instead of the unscoped `rune-editor`, which is a different (unregistered) package and an unsafe thing to load from a CDN
- Documented the dedicated **Vue** (`/vue`) and **Svelte** (`/svelte`) adapters, replacing the stale "no dedicated adapter" hand-wiring
- Completed the subpath exports table (`vue`, `svelte`, `collab`, `server`)
- Corrected the Node requirement to **≥ 18** and the adapter snippets to use the exported `StarterKit`

---

## [1.1.0] — 2026-06-10

> A big feature release: real-time collaboration, two-way Markdown, a portable
> JSON model, new container blocks, framework adapters, and a broad sweep of
> accessibility, performance, and correctness work.

### ✨ Added

#### Collaboration
- Real-time collaboration graduated to a first-class, exported feature (Yjs-backed)
- Presence: roster API, avatars, idle/away states, and follow-mode
- Suggestion mode — track-changes-style edits tagged as local, rendered per-block
- Hardened collab server: room-name validation, room-count caps, rate limiting, and send backpressure

#### Content model & Markdown
- Portable JSON document model — `getJSON()` / `setJSON()` plus server-side render
- Two-way Markdown — `setMarkdown()`, `insertMarkdown()`, and paste-as-Markdown
- Paste converts Markdown even when the clipboard also carries rich HTML
- Nested blockquotes in Markdown conversion

#### Blocks, marks & input
- Container blocks: **Toggle** (collapsible) and **Columns**
- `Highlight` mark
- InputRule / PasteRule engine, with `SmartTypography` and `InlineMarkdown` extensions
- Suggestion primitive for trigger characters (`@` / `#` / `:`)
- Non-destructive decoration / overlay layer (FindReplace highlights now ride on it)
- Video embeds are drag-to-resize (width, height, and diagonal)
- Links use an inline popover for add/edit and are clickable (⌘/Ctrl-click to open)
- Tables gain a size picker on insert and visible add/remove controls
- `toggleMark` command and element-mark support in `isActive`

#### Extensibility & adapters
- Extension registry with manifests and runtime `use()`
- **Vue 3** and **Svelte** adapters
- Hand-authored TypeScript declarations
- Config-driven playground + GitHub Pages deploy

### ♿ Accessibility
- Live region announcing key actions to assistive tech
- Accessible name and AT-visible placeholder on the editable region
- Roving tabindex + arrow-key navigation in the toolbar; `aria-pressed` on toggles
- Slash menu exposes the active option via `aria-activedescendant`
- Keyboard-operable task checkboxes and callout emoji icons; controls activate on click
- Focus-managed toolbar/bubble popups
- Honor `prefers-reduced-motion`; muted-text contrast raised to WCAG AA

### ⚡ Performance
- rAF-coalesced presence/comments overlay rendering, selectionchange emits, and toolbar active-state recompute
- rAF-throttled DragReorder with touch/pen (Pointer Events) support
- Dropped the redundant document clone in `getHtml()`

### 🐛 Fixed
- Enter inside a callout no longer splits the flex layout / jumps the caret
- Bold/Italic/etc. no longer show active inside headings
- FindReplace: Replace advances to the next match and won't re-match replacements; re-highlight debounced
- Caret position restored on undo/redo
- Deleting a table's header row promotes the first body row to header
- Line breaks preserved when toggling code blocks
- Indent/outdent/text-align apply to the editable leaf, not the container
- Markdown shortcuts guarded to the block-end caret position
- FormatPainter no longer merges blocks or churns the DOM, and reproduces super/subscript
- `onChange` no longer fires during editor construction
- Markdown export: longer backtick fences, escaped brackets, preserved relative URLs, nested lists and task inline marks
- EventBus isolates subscribers so one throwing handler can't break others
- Lifecycle cleanup: collab bindings, FormatPainter, and SlashMenu all tear down on `destroy()`
- Fixed P0/P1 code-review issues across undo, onChange, lifecycle, SSR, and the collab server

### 🔒 Security
- Broadened history-snapshot data-URI stripping to `href` and `srcset`

### 📚 Docs & packaging
- CI and release GitHub Actions workflows
- `engines.node` declared; `react`/`react-dom` marked as optional peer dependencies
- README fixes: Next.js/SSR client-only usage, React quick-start extensions, collab and config examples

---

## [1.0.1] — 2026-02-23

### 🔧 Changed
- Ship the logo in the published package and serve the README logo via jsDelivr

---

## [1.0.0] — 2026-02-23

> First public release. 🎉

### ✨ Added

#### Core Engine
- `Editor` class with full public API (`getHtml`, `setHtml`, `getText`, `getMarkdown`, `print`, `focus`, `blur`, `enable`, `disable`, `destroy`, `isEmpty`)
- `Schema` — extension registry with block, mark, and plugin type support; toolbar item caching
- `Commands` — command registry with chainable API (`editor.chain().toggleBold().toggleItalic().run()`)
- `EventBus` — pub/sub event system (`change`, `selectionchange`, `keydown`, `paste`, `slash:open`, `slash:close`)
- `History` — undo/redo stack with configurable depth
- `Selection` — caret/selection helpers (`getBlock`, `setAtStart`, `setAtEnd`, `isCollapsed`)

#### Block Extensions
- `Paragraph` — default block, auto-wraps bare text
- `Heading` — H1, H2, H3 with slash commands and markdown shortcuts
- `BulletList` / `OrderedList` — nested lists, tab to indent
- `Blockquote` — `> ` markdown shortcut
- `CodeBlock` — fenced ` ``` ` shortcut, monospace display
- `HorizontalRule` — `---` markdown shortcut
- `Callout` — Notion-style coloured callout box with emoji support
- `TaskList` — interactive checklist with click-to-toggle checkboxes
- `VideoEmbed` — YouTube/Vimeo URL → iframe embed
- `Image` — file picker + base64 preview + async `uploadImage` hook for hosted URLs
- `Table` — full table with keyboard navigation (Tab/Shift+Tab), row/column add/delete

#### Mark Extensions
- `Bold`, `Italic`, `Underline`, `Strike` — standard inline marks with keyboard shortcuts
- `Code` — inline `<code>` with `` ` `` markdown shortcut
- `Link` — `<a>` with dangerous-protocol validation
- `Superscript`, `Subscript`
- `FontSize` — em presets + custom px input
- `FontFamily` — preset font stack picker
- `TextColor`, `TextBackground` — colour palettes with live indicator swatch

#### Formatting Extensions
- `TextAlign` — left / center / right / justify per block
- `LineHeight` — 1.0 → 2.0 picker
- `Indent`, `Outdent` — list and block indentation

#### Plugin Extensions
- `MarkdownShortcuts` — converts Markdown syntax on input (block and inline)
- `FindReplace` — `⌘F` floating panel with match count, prev/next navigation, replace all
- `DragReorder` — drag handle in left gutter to reorder any block (pointer-event based)
- `FormatPainter` — copy formatting from one selection and paint it onto another

#### UI
- `Toolbar` — configurable item list; button, dropdown, and panel types; body-appended panels (never clipped)
- `BubbleMenu` — appears on text selection; hides when format painter is active
- `SlashMenu` — Notion-style `/` command palette with search filtering
- Tooltips on toolbar hover
- Dark mode via `data-theme="dark"` CSS custom properties

#### Export
- `editor.getMarkdown()` — HTML → Markdown converter (`htmlToMarkdown`) handling all block and inline types
- `editor.print()` — clean print view stripping all editor UI chrome

#### Adapters
- **React** — `useRune` hook + `RuneEditor` component
- **Web Component** — `<rune-editor>` custom element with `content`, `placeholder`, `readonly` attributes; fires `change` CustomEvent; exposes `getHtml`, `setHtml`, `getMarkdown`, `print`, `cmd`

#### Developer Experience
- `rune.config.js` — single file to enable/disable all features; changes propagate automatically
- `createFromConfig(target, config, overrides)` — factory function for config-driven setup

### 🔒 Security
- `sanitize()` strips all non-allowlisted attributes from pasted HTML
- Dangerous URL protocols (`javascript:`, `vbscript:`, `data:text/html`) blocked in `href`, `src`, and `style`
- Whitespace and null-byte stripping to prevent protocol-bypass on URL checks

---

*For upcoming features and known issues, see [TODO.md](TODO.md).*
