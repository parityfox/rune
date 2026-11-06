export const Code = {
  name: 'code',
  type: 'mark',
  tag: 'code',

  commands(editor) {
    return {
      toggleInlineCode() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;

        // Check if selection is already wrapped in <code>
        const range = sel.getRangeAt(0);
        const parent = range.commonAncestorContainer;
        const codeEl = parent.nodeType === 1 && parent.tagName === 'CODE'
          ? parent
          : parent.parentElement?.closest('code');

        if (codeEl) {
          // Unwrap
          const frag = document.createDocumentFragment();
          while (codeEl.firstChild) frag.appendChild(codeEl.firstChild);
          codeEl.replaceWith(frag);
        } else {
          // Wrap
          // A code span can't hold block elements, so a selection across blocks is a no-op.
          if (range.cloneContents().querySelector('p,h1,h2,h3,h4,h5,h6,li,ul,ol,div,blockquote,pre,table,tr,td,th,figure')) return;
          // extract + insert, not surroundContents: that throws when the selection
          // only partly covers an inline element such as <strong>.
          const code = document.createElement('code');
          code.appendChild(range.extractContents());
          range.insertNode(code);
          range.selectNodeContents(code);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        editor._notifyChange();
      },
    };
  },

  keymap: {
    'Meta+e':    (editor) => editor.cmd('toggleInlineCode'),
    'Control+e': (editor) => editor.cmd('toggleInlineCode'),
  },

  toolbarItem: {
    name: 'code',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    title: 'Inline Code (⌘E)',
    action: 'toggleInlineCode',
    isActive: (editor) => editor.isActive('code'),
  },
};
