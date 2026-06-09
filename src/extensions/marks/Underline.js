export const Underline = {
  name: 'underline',
  type: 'mark',
  tag: 'u',
  execCommand: 'underline',
  hasMark: (el) => el.tagName === 'U',

  keymap: {
    'Meta+u':    (editor) => editor.chain().toggleUnderline().run(),
    'Control+u': (editor) => editor.chain().toggleUnderline().run(),
  },

  toolbarItem: {
    name: 'underline',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>',
    title: 'Underline (⌘U)',
    action: 'toggleUnderline',
    isActive: (editor) => editor.isActive('underline'),
  },
};
