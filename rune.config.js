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
    callout:        true,   // highlighted callout box
    taskList:       true,   // checklist
    videoEmbed:     true,   // YouTube / Vimeo embed
    image:          true,   // <figure><img>
    table:          true,   // <table>
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

  // ── Formatting ─────────────────────────────────────────
  formatting: {
    textAlign:      true,   // text alignment (L/C/R/justify)
    lineHeight:     true,   // line height picker
    indent:         true,   // increase block indent
    outdent:        true,   // decrease block indent
  },

  // ── Plugins ──────────────────────────────────────────────
  plugins: {
    markdownShortcuts: true,  // auto-format: ## → H2, > → blockquote, etc.
    findReplace:       true,  // Cmd+F floating find & replace panel
    dragReorder:       true,  // drag handle to reorder blocks
    formatPainter:     true,  // copy format from selection, paint onto another
  },

  // ── Toolbar ───────────────────────────────────────────────
  toolbar: {
    enabled: true,
    items: [
      'bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', '|',
      'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'horizontalRule', '|',
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

    // Optional image upload hook — prevents base64 bloat.
    // Receives a File object, must return Promise<string> (the hosted URL).
    // If omitted, images are embedded as base64 data URLs.
    //
    // uploadImage: (file) => fetch('/api/upload', { method: 'POST', body: ... })
    //                          .then(r => r.json()).then(d => d.url),
  },

  // ── History ───────────────────────────────────────────────
  history: {
    enabled:  true,
    maxSteps: 100,
  },

};

export default config;
