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

---

## 🚀 Quick Wins

- [x] **Horizontal rule** — `<hr>` block; slash command `/divider`
- [x] **Superscript** — `<sup>` mark, toolbar button, `execCommand('superscript')`
- [x] **Subscript** — `<sub>` mark, toolbar button, `execCommand('subscript')`
- [x] **Font family** — panel picker (same pattern as FontSize); curated font list with web-safe + Google Fonts options

---

## 🧱 New Block Types

- [x] **Callout** — Notion-style colored box with emoji icon; slash `/callout`; emoji picker in panel; click icon to change emoji
- [x] **Task list / Checklist** — checklist with click-to-toggle checkboxes; Enter adds item, Backspace on empty exits; slash `/todo`
- [x] **Video embed** — paste YouTube / Vimeo URL → responsive 16:9 iframe; slash `/video`
- [ ] **Table** — insert rows/columns, Tab to navigate cells, add/remove rows & columns from context menu; slash `/table`

---

## ✍️ Formatting

- [ ] **Text alignment** — Left / Center / Right / Justify per block; toolbar button group or dropdown; stored as `style="text-align:..."`
- [ ] **Line height** — panel picker (1.0 / 1.25 / 1.5 / 1.75 / 2.0); applied as inline style on the block
- [ ] **Indent / Outdent** — increase/decrease left padding on any block (not just lists)

---

## ⚡ Editor Behaviour

- [x] **Markdown shortcuts** — auto-format on `Space` / `Enter`:
  - `## ` → H2, `### ` → H3
  - `**text**` or `__text__` → Bold
  - `*text*` or `_text_` → Italic
  - `` `code` `` → inline Code
  - `> ` → Blockquote
  - ` ``` ` → CodeBlock
  - `- ` or `* ` → BulletList
  - `1. ` → OrderedList
  - `---` → Horizontal rule
- [ ] **Find & Replace** — floating panel (`Cmd+F`); highlight all matches; step through; replace one / all
- [ ] **Drag to reorder blocks** — drag handle appears on block hover (left gutter); drag-and-drop to reorder

---

## 🔌 Ecosystem

- [ ] **Vue adapter** — `useRune` composable + `RuneEditor` component (mirrors React adapter)
- [ ] **Web Component** — `<rune-editor>` custom element for framework-agnostic drop-in use
- [ ] **Export: Markdown** — `editor.getMarkdown()` converts HTML → Markdown
- [ ] **Export: PDF** — `editor.print()` opens browser print dialog with clean print styles

---

## 💡 Future / Nice-to-have

- [ ] **Mention** — `@username` triggers autocomplete dropdown; configurable data source
- [ ] **Emoji picker** — `:smile:` shortcode autocomplete or toolbar panel
- [ ] **Collaborative editing** — OT or CRDT-based multi-user sync (big lift)
- [ ] **Comments / annotations** — highlight a range, attach a comment thread
- [ ] **Version history** — snapshot named versions, diff and restore

---

## 🐛 Known Issues / Tech Debt

- [ ] `_updateActive()` in Toolbar creates new spread objects on each call — `_el` refs not preserved; active-state highlighting does not update
- [ ] BubbleMenu panel items (textColor, textBackground) indicator not synced with Toolbar indicator
- [ ] `clearFontSize` / background removal uses `querySelectorAll` on possible text nodes (guarded with `?.` but could be smarter)
- [ ] Image `insertImage` base64 embeds can bloat HTML — should offer upload-to-URL hook

---

*Last updated: 2026-02-22*
