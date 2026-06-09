import { uid } from '../../utils/id.js';

/**
 * MarkdownShortcuts — auto-format on Space / Enter.
 *
 * Space triggers (text before cursor → block type):
 *   #        → Heading 1
 *   ##       → Heading 2
 *   ###      → Heading 3
 *   >        → Blockquote
 *   -  or *  → Bullet list
 *   1.       → Ordered list
 *   ```      → Code block
 *
 * Enter triggers:
 *   ---      → Horizontal rule
 */
export const MarkdownShortcuts = {
  name: 'markdownShortcuts',
  type: 'plugin',

  init(editor) {
    editor.events.on('keydown', ({ event: e }) => {
      if (e.key === ' ')                    _handleSpace(editor, e);
      else if (e.key === 'Enter' && !e.shiftKey) _handleEnter(editor, e);
    });
  },
};

// ── Space rules ────────────────────────────────────────────

const SPACE_RULES = [
  { pattern: /^#$/,   apply: (ed) => ed.cmd('setHeading', 1) },
  { pattern: /^##$/,  apply: (ed) => ed.cmd('setHeading', 2) },
  { pattern: /^###$/, apply: (ed) => ed.cmd('setHeading', 3) },
  { pattern: /^>$/,   apply: (ed) => ed.cmd('toggleBlockquote') },
  { pattern: /^[-*]$/,apply: (ed) => ed.cmd('toggleBulletList') },
  { pattern: /^1\.$/,  apply: (ed) => ed.cmd('toggleOrderedList') },
  { pattern: /^```$/,  apply: (ed) => ed.cmd('toggleCodeBlock') },
];

function _handleSpace(editor, e) {
  const block = editor.selection.getBlock();
  // Don't trigger inside code blocks or non-block contexts
  if (!block || block.tagName === 'PRE' || block.tagName === 'LI') return;
  // Don't trigger inside callouts or task lists
  if (block.dataset?.type === 'callout' || block.dataset?.type === 'task-list') return;
  // Only convert when the caret sits right after the marker (block end), so a
  // space typed mid-text or with the caret elsewhere doesn't reformat the block.
  if (!editor.selection.isAtBlockEnd()) return;

  const text = block.textContent.trim();

  for (const rule of SPACE_RULES) {
    if (!rule.pattern.test(text)) continue;

    e.preventDefault();
    editor.history.saveNow();
    block.innerHTML = '<br>';
    editor.selection.setAtStart(block);
    rule.apply(editor);
    return;
  }
}

// ── Enter rules ────────────────────────────────────────────

function _handleEnter(editor, e) {
  const block = editor.selection.getBlock();
  if (!block || block.tagName === 'PRE') return;
  if (block.dataset?.type === 'callout' || block.dataset?.type === 'task-list') return;
  if (!editor.selection.isAtBlockEnd()) return;

  const text = block.textContent.trim();

  if (text === '---' && editor.schema.getBlock('horizontalRule')) {
    e.preventDefault();
    editor.history.saveNow();

    const hr = document.createElement('hr');
    hr.className = 'rune-hr';
    hr.setAttribute('data-id', uid());

    const p = document.createElement('p');
    p.innerHTML = '<br>';

    editor.content.replaceChild(hr, block);
    editor.content.insertBefore(p, hr.nextSibling || null);
    editor.selection.setAtStart(p);
    editor._notifyChange();
  }
}
