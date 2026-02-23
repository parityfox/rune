export const Subscript = {
  name: 'subscript',
  type: 'mark',
  tag: 'sub',
  execCommand: 'subscript',

  commands(editor) {
    return {
      toggleSubscript: () => editor.cmd('toggleSubscript'),
    };
  },

  toolbarItem: {
    name: 'subscript',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 5 L12 19"/>
      <path d="M12 5 L4 19"/>
      <path d="M17 21 L17 15 L21 15" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M21 21 L17 21" stroke-linecap="round"/>
    </svg>`,
    title: 'Subscript',
    action: 'toggleSubscript',
    isActive: (editor) => {
      try { return document.queryCommandState('subscript'); } catch { return false; }
    },
  },
};
