export const OrderedList = {
  name: 'orderedList',
  type: 'block',
  tag: 'ol',

  commands(editor) {
    return {
      toggleOrderedList() {
        const block = editor.selection.getBlock();
        if (!block) return;
        editor.history.saveNow();
        if (block.tagName === 'OL') {
          const frag = document.createDocumentFragment();
          for (const li of block.querySelectorAll('li')) {
            const p = document.createElement('p');
            p.innerHTML = li.innerHTML;
            frag.appendChild(p);
          }
          editor.content.replaceChild(frag, block);
        } else {
          document.execCommand('insertOrderedList');
        }
        editor._notifyChange();
      },
    };
  },

  keymap: {
    'Meta+shift+7':    (editor) => editor.cmd('toggleOrderedList'),
    'Control+shift+7': (editor) => editor.cmd('toggleOrderedList'),
  },

  toolbarItem: {
    name: 'orderedList',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" font-size="7" fill="currentColor" stroke="none" font-family="monospace">1.</text><text x="2" y="14" font-size="7" fill="currentColor" stroke="none" font-family="monospace">2.</text><text x="2" y="20" font-size="7" fill="currentColor" stroke="none" font-family="monospace">3.</text></svg>',
    title: 'Ordered List',
    action: 'toggleOrderedList',
    isActive: (editor) => editor.isActive('orderedList'),
  },

  slashItem: {
    icon: '1.',
    title: 'Numbered List',
    description: 'Ordered list with numbers',
    action: (editor) => editor.cmd('toggleOrderedList'),
  },
};
