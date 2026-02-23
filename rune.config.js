/**
 * ╔══════════════════════════════════════╗
 * ║         Rune Editor Config           ║
 * ╚══════════════════════════════════════╝
 *
 * Enable or disable any feature by setting it to true / false.
 * Changes here automatically update the toolbar, bubble menu,
 * slash menu, and keyboard shortcuts — no other files to touch.
 */

const config = {

  // ── Block Types ──────────────────────────────────────────
  blocks: {
    paragraph:      true,   // <p>
    heading:        true,   // <h1>–<h3>
    bulletList:     true,   // <ul>
    orderedList:    true,   // <ol>
    blockquote:     true,   // <blockquote>
    codeBlock:      true,   // <pre><code>
    horizontalRule: true,   // <hr>
    image:          true,   // <figure><img>
  },

  // ── Inline Marks ─────────────────────────────────────────
  marks: {
    bold:           true,   // <strong>      ⌘B
    italic:         true,   // <em>          ⌘I
    underline:      true,   // <u>           ⌘U
    strike:         true,   // <s>           ⌘⇧S
    code:           true,   // <code>        ⌘E
    link:           true,   // <a>           ⌘K
    superscript:    true,   // <sup>
    subscript:      true,   // <sub>
    fontSize:       true,   // font size picker
    fontFamily:     true,   // font family picker
    textColor:      true,   // text color palette
    textBackground: true,   // highlight / background color
  },

  // ── Toolbar ───────────────────────────────────────────────
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

  // ── Bubble Menu ───────────────────────────────────────────
  bubbleMenu: {
    enabled: true,
    items: ['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', '|', 'textColor', 'textBackground', '|', 'link'],
  },

  // ── Slash Menu ────────────────────────────────────────────
  slashMenu: {
    enabled: true,
  },

  // ── Editor Behaviour ──────────────────────────────────────
  editor: {
    placeholder: "Write something, or type '/' for commands…",
    spellcheck:  true,
    autofocus:   false,
    readOnly:    false,
  },

  // ── History ───────────────────────────────────────────────
  history: {
    enabled:  true,
    maxSteps: 100,
  },

};

export default config;
