import { el } from '../../utils/dom.js';

export const BG_COLORS = [
  { label: 'Default', value: 'transparent', swatch: null },
  { label: 'Gray',    value: '#f1f1ef',      swatch: '#f1f1ef' },
  { label: 'Brown',   value: '#f4eeee',      swatch: '#f4eeee' },
  { label: 'Orange',  value: '#fbecdd',      swatch: '#fbecdd' },
  { label: 'Yellow',  value: '#fdecc8',      swatch: '#fdecc8' },
  { label: 'Green',   value: '#ddedea',      swatch: '#ddedea' },
  { label: 'Blue',    value: '#ddebf1',      swatch: '#ddebf1' },
  { label: 'Purple',  value: '#eae4f2',      swatch: '#eae4f2' },
  { label: 'Pink',    value: '#f4dfeb',      swatch: '#f4dfeb' },
  { label: 'Red',     value: '#fde8e3',      swatch: '#fde8e3' },
];

export const TextBackground = {
  name: 'textBackground',
  type: 'mark',
  tag: 'span',

  commands(editor) {
    return {
      setTextBackground(color) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;

        if (color === 'transparent' || !color) {
          // Remove existing background spans in selection
          const range = sel.getRangeAt(0);
          const spans = [...range.commonAncestorContainer.querySelectorAll?.('span[style*="background"]') || []];
          spans.forEach(s => {
            s.style.background = '';
            s.style.backgroundColor = '';
            if (!s.getAttribute('style').trim()) s.replaceWith(...s.childNodes);
          });
        } else {
          document.execCommand('hiliteColor', false, color);
          // fallback for browsers that don't support hiliteColor
          if (!document.queryCommandSupported('hiliteColor')) {
            document.execCommand('backColor', false, color);
          }
        }
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'textBackground',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" width="16" height="16">
      <text x="3" y="17" font-size="15" font-weight="700" fill="currentColor" font-family="serif">A</text>
      <rect x="3" y="19" width="15" height="3" rx="1" fill="var(--rune-bg-indicator-color, #fdecc8)" stroke="#d0d0d0" stroke-width="0.5"/>
    </svg>`,
    title: 'Highlight / Background',
    indicator: true,
    defaultColor: '#fdecc8',

    renderPanel(editor, close, item) {
      let savedRange = null;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
      const restoreSelection = () => {
        if (!savedRange) return;
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(savedRange);
      };

      const wrap = el('div', { class: 'rune-panel-colors' });
      const title = el('div', { class: 'rune-panel-section-label' }, 'HIGHLIGHT COLOR');
      wrap.appendChild(title);
      const grid = el('div', { class: 'rune-panel-color-grid' });
      for (const c of BG_COLORS) {
        const swatch = el('button', { class: 'rune-color-swatch', type: 'button', title: c.label });
        if (!c.swatch) {
          swatch.classList.add('is-default');
          swatch.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14"><line x1="2" y1="2" x2="14" y2="14" stroke="#ccc" stroke-width="1.5"/></svg>`;
        } else {
          swatch.style.background = c.swatch;
          swatch.style.border = '1px solid rgba(0,0,0,0.06)';
        }
        swatch.addEventListener('mousedown', (e) => {
          e.preventDefault();
          restoreSelection();
          editor.cmd('setTextBackground', c.value);
          if (item._indicatorEl) {
            const bg = c.swatch || 'transparent';
            item._indicatorEl.style.background = bg;
            item._el.style.setProperty('--rune-bg-indicator-color', bg);
          }
          close();
        });
        grid.appendChild(swatch);
      }
      wrap.appendChild(grid);
      return wrap;
    },

    isActive: () => false,
  },
};
