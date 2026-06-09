// textContent of a block with <br> line breaks turned into real newlines.
function _blockText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
  return clone.textContent || '';
}

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
          // Code -> paragraph: turn the code's newlines back into <br> so
          // multi-line code doesn't collapse onto a single line.
          const p = document.createElement('p');
          (block.textContent || '').split('\n').forEach((line, i) => {
            if (i > 0) p.appendChild(document.createElement('br'));
            if (line) p.appendChild(document.createTextNode(line));
          });
          if (!p.firstChild) p.innerHTML = '<br>';
          editor.content.replaceChild(p, block);
          editor.selection.setAtEnd(p);
        } else {
          // Paragraph -> code: preserve <br> line breaks as real newlines.
          const pre = document.createElement('pre');
          const code = document.createElement('code');
          code.textContent = _blockText(block);
          pre.appendChild(code);
          editor.content.replaceChild(pre, block);
          editor.selection.setAtEnd(pre);
        }
        editor._notifyChange();
      },
    };
  },

  keymap: {
    'Meta+Shift+c':    (editor) => editor.cmd('toggleCodeBlock'),
    'Control+Shift+c': (editor) => editor.cmd('toggleCodeBlock'),
  },

  toolbarItem: {
    name: 'codeBlock',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><rect x="3" y="3" width="18" height="18" rx="2" opacity="0.15" fill="currentColor" stroke="none"/></svg>',
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
