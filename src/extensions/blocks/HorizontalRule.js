import { uid } from '../../utils/id.js';

export const HorizontalRule = {
  name: 'horizontalRule',
  type: 'block',
  tag: 'hr',

  commands(editor) {
    return {
      insertHorizontalRule() {
        editor.history.saveNow();

        const hr = document.createElement('hr');
        hr.className = 'rune-hr';
        hr.setAttribute('data-id', uid());

        // Insert after current block
        const currentBlock = editor.selection.getBlock();
        const after = currentBlock?.nextSibling || null;
        editor.content.insertBefore(hr, after);

        // Add a paragraph after so the user can keep typing
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        editor.content.insertBefore(p, hr.nextSibling);
        editor.selection.setAtStart(p);
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'horizontalRule',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="7"  x2="7"  y2="7"  stroke-width="1" opacity="0.4"/>
      <line x1="3" y1="17" x2="7"  y2="17" stroke-width="1" opacity="0.4"/>
    </svg>`,
    title: 'Horizontal Rule',
    action: 'insertHorizontalRule',
    isActive: () => false,
  },

  slashItem: {
    icon: '—',
    title: 'Divider',
    description: 'A horizontal rule to separate sections',
    action: (editor) => editor.cmd('insertHorizontalRule'),
  },
};
