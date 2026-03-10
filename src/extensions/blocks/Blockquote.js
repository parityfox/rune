export const Blockquote = {
  name: 'blockquote',
  type: 'block',
  tag: 'blockquote',

  commands(editor) {
    return {
      toggleBlockquote() {
        const block = editor.selection.getBlock();
        if (!block) return;
        editor.history.saveNow();

        if (block.tagName === 'BLOCKQUOTE') {
          const p = document.createElement('p');
          p.innerHTML = block.innerHTML;
          editor.content.replaceChild(p, block);
          editor.selection.setAtEnd(p);
        } else {
          const bq = document.createElement('blockquote');
          bq.innerHTML = block.innerHTML;
          editor.content.replaceChild(bq, block);
          editor.selection.setAtEnd(bq);
        }
        editor._notifyChange();
      },
    };
  },

  keymap: {
    'Meta+Shift+b':    (editor) => editor.cmd('toggleBlockquote'),
    'Control+Shift+b': (editor) => editor.cmd('toggleBlockquote'),
  },

  toolbarItem: {
    name: 'blockquote',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>',
    title: 'Blockquote',
    action: 'toggleBlockquote',
    isActive: (editor) => editor.isActive('blockquote'),
  },

  slashItem: {
    icon: '"',
    title: 'Quote',
    description: 'Capture a quote or callout',
    action: (editor) => editor.cmd('toggleBlockquote'),
  },
};
