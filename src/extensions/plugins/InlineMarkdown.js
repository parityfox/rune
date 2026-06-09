/**
 * InlineMarkdown — wrap inline markdown syntax in the matching mark as you type:
 *   **bold**   *italic*   `code`   ~~strike~~
 * Built on the input-rule engine; one Ctrl+Z restores the literal markers.
 */
function wrap(tag) {
  return ({ match, range }) => {
    range.deleteContents();
    const el = document.createElement(tag);
    el.textContent = match[1];
    range.insertNode(el);
    // Caret just after the new mark, in the parent (so typing continues plain).
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStartAfter(el);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  };
}

export const InlineMarkdown = {
  name: 'inlineMarkdown',
  type: 'plugin',

  inputRules: [
    { find: /\*\*([^*\n]+)\*\*$/,      handler: wrap('strong') },
    { find: /~~([^~\n]+)~~$/,          handler: wrap('s') },
    { find: /`([^`\n]+)`$/,            handler: wrap('code') },
    // single * italic — not preceded by another * (so it never fires inside **)
    { find: /(?<!\*)\*([^*\n]+)\*$/,   handler: wrap('em') },
    { find: /(?<!_)_([^_\n]+)_$/,      handler: wrap('em') },
  ],
};
