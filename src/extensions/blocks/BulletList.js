export const BulletList = {
  name: 'bulletList',
  type: 'block',
  tag: 'ul',

  commands(editor) {
    return {
      toggleBulletList() {
        const block = editor.selection.getBlock();
        if (!block) return;
        editor.history.saveNow();
        if (block.tagName === 'UL') {
          // Unwrap list items into paragraphs
          const frag = document.createDocumentFragment();
          for (const li of block.querySelectorAll('li')) {
            const p = document.createElement('p');
            p.innerHTML = li.innerHTML;
            frag.appendChild(p);
          }
          editor.content.replaceChild(frag, block);
        } else {
          document.execCommand('insertUnorderedList');
        }
        editor._notifyChange();
      },
    };
  },

  keymap: {
    'Meta+shift+8':    (editor) => editor.cmd('toggleBulletList'),
    'Control+shift+8': (editor) => editor.cmd('toggleBulletList'),
  },

  toolbarItem: {
    name: 'bulletList',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>',
    title: 'Bullet List',
    action: 'toggleBulletList',
    isActive: (editor) => editor.isActive('bulletList'),
  },

  slashItem: {
    icon: '•',
    title: 'Bullet List',
    description: 'Unordered list of items',
    action: (editor) => editor.cmd('toggleBulletList'),
  },
};
