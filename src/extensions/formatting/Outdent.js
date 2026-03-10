const INDENT_STEP = 24; // must match Indent.js

export const Outdent = {
  name: 'outdent',
  type: 'formatting',

  commands(editor) {
    return {
      outdentBlock() {
        const block = editor.selection.getBlock();
        if (!block) return;
        const cur = parseInt(block.style.paddingLeft || '0', 10);
        if (cur <= 0) return;
        editor.history.saveNow();
        const next = cur - INDENT_STEP;
        block.style.paddingLeft = next > 0 ? `${next}px` : '';
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'outdent',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3"  y1="5"  x2="21" y2="5"/>
      <line x1="11" y1="11" x2="21" y2="11"/>
      <line x1="11" y1="17" x2="21" y2="17"/>
      <line x1="3"  y1="21" x2="21" y2="21"/>
      <polyline points="7 9 3 11 7 13"/>
    </svg>`,
    title: 'Decrease Indent',
    action: 'outdentBlock',
    isActive: () => false,
  },
};
