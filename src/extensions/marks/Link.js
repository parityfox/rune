import { _isDangerousUrl } from '../../utils/html.js';

export const Link = {
  name: 'link',
  type: 'mark',
  tag: 'a',

  commands(editor) {
    return {
      setLink(href, text) { editor.cmd('setLink', href, text); },
      unsetLink()         { editor.cmd('unsetLink'); },
      toggleLink(href) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const anchor = range.commonAncestorContainer?.parentElement?.closest('a')
          || (range.commonAncestorContainer.tagName === 'A'
              ? range.commonAncestorContainer : null);

        if (anchor) {
          editor.cmd('unsetLink');
        } else {
          const url = prompt('Enter URL:', 'https://');
          if (url && !_isDangerousUrl(url)) editor.cmd('setLink', url);
        }
      },
    };
  },

  keymap: {
    'Meta+k':    (editor) => editor.cmd('toggleLink'),
    'Control+k': (editor) => editor.cmd('toggleLink'),
  },

  toolbarItem: {
    name: 'link',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    title: 'Link (⌘K)',
    action: 'toggleLink',
    isActive: (editor) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      const node = sel.getRangeAt(0).commonAncestorContainer;
      return !!(node?.parentElement?.closest('a'));
    },
  },
};
