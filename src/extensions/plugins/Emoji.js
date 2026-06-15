import { el } from '../../utils/dom.js';

/**
 * Emoji — `:shortcode:` autocomplete inserting a unicode emoji, plus a toolbar
 * button that opens an emoji picker and drops the chosen emoji inline at the
 * caret. Self-contained (no configuration needed).
 */
const EMOJI = {
  smile: '😄', grin: '😁', joy: '😂', wink: '😉', heart: '❤️', fire: '🔥',
  tada: '🎉', rocket: '🚀', eyes: '👀', '+1': '👍', '-1': '👎', check: '✅',
  x: '❌', star: '⭐', wave: '👋', thinking: '🤔', clap: '👏', pray: '🙏',
  bulb: '💡', warning: '⚠️', sparkles: '✨', sob: '😭', sunglasses: '😎',
  coffee: '☕', bug: '🐛', zap: '⚡', point_up: '☝️', ok: '👌',
};

// Curated palette for the toolbar picker, grouped so the grid stays scannable.
const EMOJI_GROUPS = [
  { label: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','🙂','😉','😍','😘','😎','🤔','🤨','😐','😴','😮','😢','😭','😤','😠','🥳','😇','🤩','🥰','😅'] },
  { label: 'Gestures', emojis: ['👍','👎','👌','✌️','🤞','🙏','👏','🙌','👋','🤝','💪','✍️','👀','🤙','🤟'] },
  { label: 'Symbols', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','💔','⭐','🌟','✨','🔥','💯','✅','❌','⚠️','❓','❗','💡','🎯','♻️','🔔'] },
  { label: 'Objects', emojis: ['🎉','🎊','🚀','📌','📎','📝','📚','💻','📱','⏰','🔒','🔑','🎁','☕','🍕','🎵','📈','📉','🏆','🐛','⚡','💬'] },
];

export const Emoji = {
  name: 'emoji',
  type: 'plugin',

  // Insert an emoji inline at the current caret (used by the toolbar picker).
  commands(editor) {
    return {
      insertEmoji(char) {
        if (!char) return;
        const sel = window.getSelection();
        // Restored selection must live inside the editor; otherwise drop the
        // emoji at the end of the content rather than wherever focus wandered.
        if (!sel || !sel.rangeCount || !editor.content.contains(sel.getRangeAt(0).startContainer)) {
          editor.selection.setAtEnd(editor.content.lastElementChild || editor.content);
        }
        editor.history.saveNow();
        const range = window.getSelection().getRangeAt(0);
        range.deleteContents();
        const tn = document.createTextNode(char);
        range.insertNode(tn);
        const after = document.createRange();
        after.setStartAfter(tn);
        after.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(after);
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'emoji',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>`,
    title: 'Emoji',
    indicator: false,

    renderPanel(editor, close) {
      // Capture the live caret before the popup steals focus on open, so the
      // emoji lands where the user was actually typing.
      let savedRange = null;
      const sel = window.getSelection();
      if (sel && sel.rangeCount && editor.content.contains(sel.getRangeAt(0).startContainer)) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }
      const restoreSelection = () => {
        if (!savedRange) return;
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(savedRange);
      };

      const wrap = el('div', { class: 'rune-panel-emoji-picker' });
      for (const group of EMOJI_GROUPS) {
        wrap.appendChild(el('div', { class: 'rune-panel-section-label' }, group.label.toUpperCase()));
        const grid = el('div', { class: 'rune-panel-emoji-grid' });
        for (const emoji of group.emojis) {
          const btn = el('button', { class: 'rune-panel-emoji-btn', type: 'button' }, emoji);
          btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            restoreSelection();
            editor.cmd('insertEmoji', emoji);
            close();
          });
          grid.appendChild(btn);
        }
        wrap.appendChild(grid);
      }
      return wrap;
    },
  },

  suggestion: {
    char: ':',
    items: ({ query }) => {
      const q = query.toLowerCase();
      if (!q) return [];
      return Object.entries(EMOJI)
        .filter(([name]) => name.includes(q))
        .slice(0, 8)
        .map(([name, char]) => ({ name, char }));
    },
    render: (item) => {
      const r = document.createElement('div');
      r.className = 'rune-suggestion-row';
      r.textContent = `${item.char}  :${item.name}:`;
      return r;
    },
    command: ({ editor, item, range }) => {
      range.deleteContents();
      const tn = document.createTextNode(item.char);
      range.insertNode(tn);
      const r = document.createRange(); r.setStartAfter(tn); r.collapse(true);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      editor._notifyChange();
    },
  },
};
