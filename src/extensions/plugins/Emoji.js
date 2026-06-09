/**
 * Emoji — `:shortcode:` autocomplete inserting a unicode emoji. Self-contained
 * (no configuration needed).
 */
const EMOJI = {
  smile: '😄', grin: '😁', joy: '😂', wink: '😉', heart: '❤️', fire: '🔥',
  tada: '🎉', rocket: '🚀', eyes: '👀', '+1': '👍', '-1': '👎', check: '✅',
  x: '❌', star: '⭐', wave: '👋', thinking: '🤔', clap: '👏', pray: '🙏',
  bulb: '💡', warning: '⚠️', sparkles: '✨', sob: '😭', sunglasses: '😎',
  coffee: '☕', bug: '🐛', zap: '⚡', point_up: '☝️', ok: '👌',
};

export const Emoji = {
  name: 'emoji',
  type: 'plugin',

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
