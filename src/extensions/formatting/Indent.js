const INDENT_STEP = 24; // px per indent level
const MAX_INDENT  = 240;

export const Indent = {
  name: 'indent',
  type: 'formatting',

  commands(editor) {
    return {
      indentBlock() {
        const block = editor.selection.getBlock();
        if (!block) return;
        const cur = parseInt(block.style.paddingLeft || '0', 10);
        if (cur >= MAX_INDENT) return;
        editor.history.saveNow();
        block.style.paddingLeft = `${cur + INDENT_STEP}px`;
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'indent',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3"  y1="5"  x2="21" y2="5"/>
      <line x1="11" y1="11" x2="21" y2="11"/>
      <line x1="11" y1="17" x2="21" y2="17"/>
      <line x1="3"  y1="21" x2="21" y2="21"/>
      <polyline points="3 9 7 11 3 13"/>
    </svg>`,
    title: 'Increase Indent',
    action: 'indentBlock',
    isActive: () => false,
  },
};
