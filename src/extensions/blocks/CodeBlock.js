export const CodeBlock = {
  name: 'codeBlock',
  type: 'block',
  tag: 'pre',

  commands(editor) {
    return {
      toggleCodeBlock() {
        const block = editor.selection.getBlock();
        if (!block) return;
        editor.history.saveNow();

        if (block.tagName === 'PRE') {
          const p = document.createElement('p');
          p.textContent = block.textContent;
          editor.content.replaceChild(p, block);
          editor.selection.setAtEnd(p);
        } else {
          const pre = document.createElement('pre');
          const code = document.createElement('code');
          code.textContent = block.textContent;
          pre.appendChild(code);
          editor.content.replaceChild(pre, block);
          editor.selection.setAtEnd(pre);
        }
        editor._notifyChange();
      },
    };
  },

  keymap: {
    'Meta+shift+c':    (editor) => editor.cmd('toggleCodeBlock'),
    'Control+shift+c': (editor) => editor.cmd('toggleCodeBlock'),
  },

  toolbarItem: {
    name: 'codeBlock',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><rect x="3" y="3" width="18" height="18" rx="2" opacity="0.15" fill="currentColor" stroke="none"/></svg>',
    title: 'Code Block',
    action: 'toggleCodeBlock',
    isActive: (editor) => editor.isActive('codeBlock'),
  },

  slashItem: {
    icon: '</>',
    title: 'Code Block',
    description: 'Write code with monospace font',
    action: (editor) => editor.cmd('toggleCodeBlock'),
  },
};
