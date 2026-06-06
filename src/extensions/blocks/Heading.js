/**
 * Heading extension — registers H1–H6 and toolbar/slash items.
 *
 * Usage:
 *   editor.cmd('setHeading', 1)  // sets current block to <h1>
 *   editor.cmd('setHeading', 2)  // sets current block to <h2>
 */
export const Heading = {
  name: 'heading',
  type: 'block',
  tag: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

  commands(editor) {
    return {
      setHeading(level) {
        const tag = `h${level}`;
        const current = editor.selection.getBlock();
        if (!current) return;
        editor.history.saveNow();
        const newBlock = document.createElement(tag);
        newBlock.innerHTML = current.innerHTML || '<br>';
        editor.content.replaceChild(newBlock, current);
        editor.selection.setAtEnd(newBlock);
        editor._notifyChange();
      },
    };
  },

  keymap: {
    'Meta+Alt+1':    (e) => e.cmd('setHeading', 1),
    'Meta+Alt+2':    (e) => e.cmd('setHeading', 2),
    'Meta+Alt+3':    (e) => e.cmd('setHeading', 3),
    'Control+Alt+1': (e) => e.cmd('setHeading', 1),
    'Control+Alt+2': (e) => e.cmd('setHeading', 2),
    'Control+Alt+3': (e) => e.cmd('setHeading', 3),
  },

  toolbarItem: {
    name: 'heading',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M4 6v12M20 6v12"/></svg>',
    title: 'Heading',
    action: null, // opens a dropdown — handled by Toolbar
    dropdown: [
      { label: 'Heading 1', action: 'setHeading', args: [1], isActive: (e) => e.isActive('heading') && e.selection.getBlock()?.tagName === 'H1' },
      { label: 'Heading 2', action: 'setHeading', args: [2], isActive: (e) => e.selection.getBlock()?.tagName === 'H2' },
      { label: 'Heading 3', action: 'setHeading', args: [3], isActive: (e) => e.selection.getBlock()?.tagName === 'H3' },
    ],
    isActive: (editor) => /^H[1-6]$/.test(editor.selection.getBlock()?.tagName),
  },

  slashItem: null, // heading uses individual slash items below
};
