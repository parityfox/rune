# Rune Editor — Feature Roadmap

## Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

---

## ✅ Completed

- [x] Core editor (contenteditable, history, event bus, schema, commands)
- [x] Extensions: Bold, Italic, Underline, Strike, Code, Link
- [x] Extensions: Heading (H1–H3), Paragraph, BulletList, OrderedList, Blockquote, CodeBlock
- [x] Extensions: FontSize (em + custom px), TextColor, TextBackground, Image
- [x] Toolbar with button / dropdown / panel types (body-appended, never clipped)
- [x] Bubble menu (appears on text selection, supports panel items)
- [x] Slash menu (Notion-style `/` command palette)
- [x] Tooltip on toolbar hover
- [x] Config file (`rune.config.js`) to enable/disable features
- [x] React adapter (`useRune` hook + `RuneEditor` component)
- [x] Dark mode via CSS custom properties
- [x] Selection preservation when panels are open
- [x] Horizontal rule, Superscript, Subscript, Font family
- [x] Callout, Task list, Video embed, Table
- [x] Text alignment, Line height, Indent / Outdent
- [x] Markdown shortcuts, Find & Replace, Drag to reorder blocks
- [x] Web Component (`<rune-editor>`), Markdown export, PDF print
- [x] Format Painter (copy & paste formatting)
- [x] Security hardening (javascript: URL blocking, sanitizer improvements)

---

## 🧱 New Block Types

- [ ] **Toggle / Accordion** — collapsible section with a title and hidden body; click to expand/collapse; slash `/toggle`
- [ ] **Columns** — multi-column layout (2 or 3 cols); drag blocks between columns; slash `/columns`
- [ ] **Math block** — full-width LaTeX equation via KaTeX (no server needed); slash `/math`
- [ ] **Code block with language switcher** — upgrade existing CodeBlock with language selector dropdown + syntax highlighting via Prism/highlight.js
- [ ] **File attachment** — upload a file, render as a download card (icon + name + size); slash `/file`; uses uploadFile hook
- [ ] **Embed / Bookmark** — paste any URL → fetch Open Graph metadata → render as a rich link card (title, description, image, domain); slash `/embed`
- [ ] **Quote with attribution** — styled blockquote with author name + source link; slash `/quote`
- [ ] **Progress bar** — simple visual bar with a percentage value; slash `/progress`
- [ ] **Divider with label** — `<hr>` variant with centred text label; slash `/divider-label`
- [ ] **Button** — styled clickable button with configurable text + URL; slash `/button`
- [ ] **Audio** — upload or embed audio with a minimal player (play/pause/scrub); slash `/audio`
- [ ] **Gallery** — multi-image grid; click to add images; lightbox on click; slash `/gallery`

---

## ✍️ Inline Marks

- [ ] **Highlight** — marker-pen yellow/green/pink highlight distinct from background colour; toolbar button
- [ ] **Keyboard shortcut** — `<kbd>` tag for rendering key names (e.g. `⌘K`); slash or toolbar
- [ ] **Abbreviation** — `<abbr title="…">` with tooltip on hover; useful for technical docs
- [ ] **Inline math** — LaTeX math wrapped in `$...$`; renders via KaTeX inline
- [ ] **Footnote** — inline `[1]` marker that links to a footnote section auto-generated at the bottom

---

## ⚡ Editor Behaviour

- [ ] **Word / character count** — live counter in footer bar (words, characters, reading time)
- [ ] **Auto-save** — debounced save with configurable interval; visual "Saved" / "Saving…" indicator; `onAutoSave` hook
- [ ] **Focus mode** — dims everything outside the current paragraph; toggle via toolbar or `⌘⇧F`
- [ ] **Typewriter mode** — keeps active line vertically centred; toggle via toolbar
- [ ] **Fullscreen mode** — hides browser chrome; `⌘⇧↵` or toolbar button
- [ ] **Block duplication** — duplicate any block with a button on the drag handle or `⌘D`
- [ ] **Smart typography** — auto-convert `"quotes"` → `"curly"`, `--` → `—`, `...` → `…`
- [ ] **Paste as plain text** — `⌘⇧V` strips all formatting on paste
- [ ] **Table of contents** — auto-generated panel listing all headings with anchor links; `editor.getToc()`
- [ ] **Snippet / template system** — user-defined text shortcuts that expand on trigger (e.g. `/sig` → signature block)
- [ ] **Block selection mode** — click margin to select whole block; Shift+click to range-select; bulk delete/move/format
- [ ] **Drag to select multiple blocks** — drag in left gutter to select a range of blocks
- [ ] **Image resize** — drag handles on image corners to resize; aspect-ratio locked
- [ ] **Image alignment** — float left / float right / full-width options on image context menu
- [ ] **Custom placeholder per block type** — configurable placeholder text for each block type, not just the editor-level one

---

## 🔌 Ecosystem

- [ ] **Vue adapter** — `useRune` composable + `RuneEditor` component (mirrors React adapter)
- [ ] **Svelte adapter** — `useRune` action + `RuneEditor` component
- [ ] **Export: DOCX** — `editor.getDocx()` converts HTML → .docx via docx.js (client-side)
- [x] **Import: Markdown** — `editor.setMarkdown(md)` / `editor.insertMarkdown(md)` / `markdownToHtml(md)`; Markdown-looking text is also converted on paste (`pasteMarkdown` option)
- [ ] **Import: DOCX** — drag & drop or file picker to import a .docx file
- [ ] **SSR / server-side rendering** — safe initialisation when `document` is not available (Next.js, Nuxt)

---

## 👥 Collaboration & Social

- [ ] **Mention** — `@username` triggers an autocomplete dropdown; configurable data source via `fetchMentions` hook
- [ ] **Hashtag** — `#tag` auto-links; configurable `onHashtag` hook
- [x] **Collaborative editing** — real-time multi-user sync via Yjs CRDT + WebSocket provider (`@parityfox/rune-editor/collab`, `collab()` facade). _v1 limits: single-block comments/suggestions; multi-block paste flattens; reorder clones blocks._
- [x] **Presence indicators** — remote cursors, selection highlights, and typing labels via Yjs Awareness
- [~] **Comments / annotations** — threaded comments anchored via RelativePositions with orphan detection (single-block ranges in v1; side panel UI is consumer-provided)
- [~] **Track changes** — tracked-change suggestions with per-change accept/reject and author colour (single-block ranges in v1)

---

## 🕓 History & Versions

- [ ] **Version history** — named snapshots (manual + auto); diff view between any two versions; one-click restore
- [ ] **Local persistence** — `localStorage` / `IndexedDB` adapter so content survives page refresh automatically
- [ ] **Change log** — append-only log of who changed what and when (requires auth integration)

---

## 🤖 AI Features

- [ ] **AI completion** — ghost text inline suggestion as user types; `Tab` to accept; configurable AI provider hook
- [ ] **AI rewrite** — select text → bubble menu → "Improve", "Shorten", "Expand", "Formal", "Casual"
- [ ] **AI summarise** — summarise the whole document or selection into a callout block
- [ ] **AI generate** — `/ai` slash command opens a prompt input; generates content inline
- [ ] **AI translate** — select text → translate to any language via AI provider
- [ ] **AI grammar fix** — underline grammar issues; click to see suggestions (like Grammarly)

---

## ♿ Accessibility

- [ ] **Full ARIA roles and labels** — audit and fill gaps in toolbar, menus, panels
- [ ] **Screen reader announcements** — live region updates when formatting changes
- [ ] **High contrast mode** — `data-theme="high-contrast"` CSS layer
- [ ] **Keyboard-only operation** — every toolbar action reachable without a mouse; logical tab order
- [ ] **Focus management** — trap focus inside open panels/modals; restore on close

---

## 📱 Mobile & Touch

- [ ] **Touch-optimised toolbar** — larger tap targets; scrollable on small screens
- [ ] **Touch drag-to-reorder** — replace mousedown drag with pointer events for touch support
- [ ] **Selection handles** — native-style selection handles on mobile for text selection
- [ ] **Virtual keyboard handling** — reposition toolbar above virtual keyboard when it appears

---

## 🎨 Theming & Customisation

- [ ] **Theme presets** — built-in themes: Minimal, Academic, Technical, Newspaper
- [ ] **Custom theme builder panel** — live CSS variable editor in-browser
- [ ] **Per-block background** — set a background colour on any block (not just callouts)
- [ ] **Editor width presets** — Narrow / Normal / Wide / Full — configurable per editor instance
- [ ] **Custom toolbar position** — top (default), bottom, floating, or hidden

---

## 🐛 Known Issues / Tech Debt

- [ ] Table: missing keyboard support for adding rows with Enter in last cell on some browsers
- [ ] Slash menu: no fuzzy search — requires exact prefix match
- [ ] Image upload: no progress indicator during upload (only a pulse animation)
- [x] `getMarkdown()`: nested lists now converted with indentation; round-trips with `markdownToHtml()`
- [ ] `print()`: uses `document.write()` — consider blob URL approach for stricter CSP compatibility
- [ ] Mobile: bubble menu positioning breaks when virtual keyboard is open

---

*Last updated: 2026-02-23*
