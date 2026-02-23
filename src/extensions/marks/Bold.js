export const Bold = {
  name: 'bold',
  type: 'mark',
  tag: 'strong',
  execCommand: 'bold',

  commands(editor) {
    return {
      toggleBold: () => editor.cmd('toggleBold'),
    };
  },

  keymap: {
    'Meta+b':    (editor) => editor.chain().toggleBold().run(),
    'Control+b': (editor) => editor.chain().toggleBold().run(),
  },

  toolbarItem: {
    name: 'bold',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>',
    title: 'Bold (⌘B)',
    action: 'toggleBold',
    isActive: (editor) => editor.isActive('bold'),
  },
};
