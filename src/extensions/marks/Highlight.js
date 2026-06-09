import { el } from '../../utils/dom.js';

export const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: 'yellow', swatch: 'rgba(250,204,21,0.5)' },
  { label: 'Green',  value: 'green',  swatch: 'rgba(34,197,94,0.45)' },
  { label: 'Blue',   value: 'blue',   swatch: 'rgba(59,130,246,0.45)' },
  { label: 'Pink',   value: 'pink',   swatch: 'rgba(236,72,153,0.4)' },
  { label: 'Orange', value: 'orange', swatch: 'rgba(249,115,22,0.45)' },
];

/**
 * Highlight — marker-pen style highlight via <mark class="rune-hl-{color}">.
 * Built on the generic toggleMark command; reports active state through the
 * element-mark path in Editor.isActive().
 */
export const Highlight = {
  name: 'highlight',
  type: 'mark',
  tag: 'mark',
  match: (el) => el.tagName === 'MARK',
  hasMark: (el) => el.tagName === 'MARK',

  commands(editor) {
    return {
      toggleHighlight(color = 'yellow') {
        editor.cmd('toggleMark', 'mark', { class: `rune-hl-${color}` });
      },
      unsetHighlight() {
        if (editor.isActive('highlight')) editor.cmd('toggleMark', 'mark', {});
      },
    };
  },

  keymap: {
    'Meta+Shift+h':    (editor) => editor.cmd('toggleHighlight'),
    'Control+Shift+h': (editor) => editor.cmd('toggleHighlight'),
  },

  toolbarItem: {
    name: 'highlight',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
      <path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
    </svg>`,
    title: 'Highlight',

    renderPanel(editor, close) {
      let saved = null;
      const sel = window.getSelection();
      if (sel && sel.rangeCount) saved = sel.getRangeAt(0).cloneRange();
      const restore = () => { if (saved) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); } };

      const wrap = el('div', { class: 'rune-panel-colors' });
      wrap.appendChild(el('div', { class: 'rune-panel-section-label' }, 'HIGHLIGHT'));
      const grid = el('div', { class: 'rune-panel-color-grid' });

      const none = el('button', { class: 'rune-color-swatch is-default', type: 'button', title: 'None' }, '✕');
      none.addEventListener('mousedown', (e) => { e.preventDefault(); restore(); editor.cmd('unsetHighlight'); close(); });
      grid.appendChild(none);

      for (const c of HIGHLIGHT_COLORS) {
        const sw = el('button', { class: 'rune-color-swatch', type: 'button', title: c.label });
        sw.style.background = c.swatch;
        sw.addEventListener('mousedown', (e) => { e.preventDefault(); restore(); editor.cmd('toggleHighlight', c.value); close(); });
        grid.appendChild(sw);
      }
      wrap.appendChild(grid);
      return wrap;
    },

    isActive: (editor) => editor.isActive('highlight'),
  },
};
