export const Paragraph = {
  name: 'paragraph',
  type: 'block',
  tag: 'p',

  commands(editor) {
    return {
      setParagraph: () => editor.cmd('setBlock', 'paragraph'),
    };
  },

  toolbarItem: {
    name: 'paragraph',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 4v16M9 4h8a4 4 0 0 1 0 8H9V4z"/></svg>',
    title: 'Paragraph',
    action: 'setParagraph',
    isActive: (editor) => editor.isActive('paragraph'),
  },

  slashItem: {
    icon: '¶',
    title: 'Paragraph',
    description: 'Plain paragraph text',
    action: (editor) => editor.chain().setParagraph().run(),
  },
};
