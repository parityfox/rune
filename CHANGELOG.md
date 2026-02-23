# 📋 Changelog

All notable changes to Rune are documented here.

This project adheres to [Semantic Versioning](https://semver.org/). Dates follow `YYYY-MM-DD`.

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
