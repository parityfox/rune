import { el } from '../../utils/dom.js';
import { uid } from '../../utils/id.js';

const EMOJIS = ['💡','📝','⚠️','✅','❌','🔥','💬','🎯','📌','ℹ️','🚀','💎','📢','🧠','👀','🛠️','🎉','🔒','📊','⭐'];

const COLORS = [
  { label: 'Yellow', value: 'yellow', bg: '#fdecc8', border: '#f5d687' },
  { label: 'Blue',   value: 'blue',   bg: '#ddebf1', border: '#a7c9da' },
  { label: 'Green',  value: 'green',  bg: '#ddedea', border: '#9bcfc5' },
  { label: 'Red',    value: 'red',    bg: '#fde8e3', border: '#f4b4a4' },
  { label: 'Purple', value: 'purple', bg: '#eae4f2', border: '#c4aee2' },
  { label: 'Gray',   value: 'gray',   bg: '#f1f1ef', border: '#d3d3ce' },
];

export const Callout = {
  name: 'callout',
  type: 'block',
  tag: 'div',

  commands(editor) {
    // Click icon to change emoji
    editor.content.addEventListener('click', (e) => {
      const icon = e.target.closest('.rune-callout-icon');
      if (!icon) return;
      e.preventDefault();
      _openEmojiPicker(editor, icon);
    });

    return {
      insertCallout(emoji = '💡', color = 'yellow') {
        editor.history.saveNow();

        const wrap = document.createElement('div');
        wrap.className = `rune-callout rune-callout--${color}`;
        wrap.setAttribute('data-type', 'callout');
        wrap.setAttribute('data-id', uid());

        const icon = document.createElement('span');
        icon.className = 'rune-callout-icon';
        icon.setAttribute('contenteditable', 'false');
        icon.textContent = emoji;

        const body = document.createElement('div');
        body.className = 'rune-callout-body';
        body.innerHTML = '<br>';

        wrap.appendChild(icon);
        wrap.appendChild(body);

        const currentBlock = editor.selection.getBlock();
        const after = currentBlock?.nextSibling || null;
        if (currentBlock && currentBlock.textContent.trim() === '') {
          editor.content.replaceChild(wrap, currentBlock);
        } else {
          editor.content.insertBefore(wrap, after);
        }

        editor.selection.setAtStart(body);
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'callout',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <line x1="8" y1="9"  x2="16" y2="9"/>
      <line x1="8" y1="13" x2="14" y2="13"/>
    </svg>`,
    title: 'Callout',
    indicator: false,

    renderPanel(editor, close) {
      let selectedEmoji = '💡';
      let selectedColor = 'yellow';

      const wrap = el('div', { class: 'rune-panel-callout' });

      // Emoji grid
      const emojiLabel = el('div', { class: 'rune-panel-section-label' }, 'EMOJI');
      const emojiGrid  = el('div', { class: 'rune-panel-emoji-grid' });
      let activeEmojiBtn = null;

      for (const emoji of EMOJIS) {
        const btn = el('button', { class: 'rune-panel-emoji-btn', type: 'button' }, emoji);
        if (emoji === selectedEmoji) { btn.classList.add('is-active'); activeEmojiBtn = btn; }
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectedEmoji = emoji;
          activeEmojiBtn?.classList.remove('is-active');
          btn.classList.add('is-active');
          activeEmojiBtn = btn;
        });
        emojiGrid.appendChild(btn);
      }

      // Color row
      const colorLabel = el('div', { class: 'rune-panel-section-label' }, 'COLOR');
      const colorRow   = el('div', { class: 'rune-panel-callout-colors' });
      let activeColorBtn = null;

      for (const c of COLORS) {
        const btn = el('button', { class: 'rune-panel-callout-color', type: 'button', title: c.label });
        btn.style.background   = c.bg;
        btn.style.borderColor  = c.border;
        if (c.value === selectedColor) { btn.classList.add('is-active'); activeColorBtn = btn; }
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectedColor = c.value;
          activeColorBtn?.classList.remove('is-active');
          btn.classList.add('is-active');
          activeColorBtn = btn;
        });
        colorRow.appendChild(btn);
      }

      // Insert button
      const insertBtn = el('button', { class: 'rune-panel-btn-primary', type: 'button', style: 'width:100%;margin-top:10px' }, 'Insert Callout');
      insertBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        editor.cmd('insertCallout', selectedEmoji, selectedColor);
        close();
      });

      wrap.appendChild(emojiLabel);
      wrap.appendChild(emojiGrid);
      wrap.appendChild(colorLabel);
      wrap.appendChild(colorRow);
      wrap.appendChild(insertBtn);
      return wrap;
    },

    isActive: (editor) => editor.selection.getBlock()?.dataset?.type === 'callout',
  },

  slashItem: {
    icon: '💡',
    title: 'Callout',
    description: 'Highlighted box with an icon',
    action: (editor) => editor.cmd('insertCallout'),
  },
};

// ── Inline emoji picker (click icon in callout) ─────────────

function _openEmojiPicker(editor, iconEl) {
  // Remove any existing picker
  document.querySelector('.rune-callout-emoji-picker')?.remove();

  const picker = document.createElement('div');
  picker.className = 'rune-callout-emoji-picker rune-toolbar-popup';

  const grid = document.createElement('div');
  grid.className = 'rune-panel-emoji-grid';

  for (const emoji of EMOJIS) {
    const btn = document.createElement('button');
    btn.className = 'rune-panel-emoji-btn';
    btn.type = 'button';
    btn.textContent = emoji;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      iconEl.textContent = emoji;
      picker.remove();
      editor._notifyChange();
    });
    grid.appendChild(btn);
  }

  picker.appendChild(grid);
  document.body.appendChild(picker);

  // Position below the icon
  const r = iconEl.getBoundingClientRect();
  picker.style.top  = `${r.bottom + 5}px`;
  picker.style.left = `${r.left}px`;
  requestAnimationFrame(() => picker.classList.add('is-open'));

  // Close on outside click
  const close = (e) => {
    if (!picker.contains(e.target) && e.target !== iconEl) {
      picker.remove();
      document.removeEventListener('mousedown', close);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', close), 0);
}
