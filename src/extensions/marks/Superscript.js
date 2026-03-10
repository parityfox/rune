export const Superscript = {
  name: 'superscript',
  type: 'mark',
  tag: 'sup',
  execCommand: 'superscript',

  toolbarItem: {
    name: 'superscript',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 19 L12 5"/>
      <path d="M12 19 L4 5"/>
      <path d="M17 9 L17 3 L21 3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M21 9 L17 9" stroke-linecap="round"/>
    </svg>`,
    title: 'Superscript',
    action: 'toggleSuperscript',
    isActive: (editor) => {
      try { return document.queryCommandState('superscript'); } catch { return false; }
    },
  },
};
