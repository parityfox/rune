export const Strike = {
  name: 'strike',
  type: 'mark',
  tag: 's',
  execCommand: 'strikeThrough',
  hasMark: (el) => el.tagName === 'S' || el.tagName === 'STRIKE' || el.tagName === 'DEL',

  keymap: {
    'Meta+Shift+s':    (editor) => editor.chain().toggleStrike().run(),
    'Control+Shift+s': (editor) => editor.chain().toggleStrike().run(),
  },

  toolbarItem: {
    name: 'strike',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><path d="M17.5 5.5C16.5 4 15 3 12 3c-3.5 0-6 2-6 5 0 1.2.4 2.2 1 3"/><path d="M6.5 18.5C7.5 20 9 21 12 21c3.5 0 6-2 6-5 0-1.2-.4-2.2-1-3"/></svg>',
    title: 'Strikethrough',
    action: 'toggleStrike',
    isActive: (editor) => editor.isActive('strike'),
  },
};
