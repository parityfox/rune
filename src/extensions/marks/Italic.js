export const Italic = {
  name: 'italic',
  type: 'mark',
  tag: 'em',
  execCommand: 'italic',

  keymap: {
    'Meta+i':    (editor) => editor.chain().toggleItalic().run(),
    'Control+i': (editor) => editor.chain().toggleItalic().run(),
  },

  toolbarItem: {
    name: 'italic',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
    title: 'Italic (⌘I)',
    action: 'toggleItalic',
    isActive: (editor) => editor.isActive('italic'),
  },
};
