import { el } from '../../utils/dom.js';

export const TEXT_COLORS = [
  { label: 'Default', value: 'inherit',  swatch: '#1a1a1a' },
  { label: 'Gray',    value: '#9b9b9b',  swatch: '#9b9b9b' },
  { label: 'Brown',   value: '#64473a',  swatch: '#64473a' },
  { label: 'Orange',  value: '#d9730d',  swatch: '#d9730d' },
  { label: 'Yellow',  value: '#dfab01',  swatch: '#dfab01' },
  { label: 'Green',   value: '#0f7b6c',  swatch: '#0f7b6c' },
  { label: 'Blue',    value: '#0b6e99',  swatch: '#0b6e99' },
  { label: 'Purple',  value: '#6940a5',  swatch: '#6940a5' },
  { label: 'Pink',    value: '#ad1a72',  swatch: '#ad1a72' },
  { label: 'Red',     value: '#e03e3e',  swatch: '#e03e3e' },
];

export const TextColor = {
  name: 'textColor',
  type: 'mark',
  tag: 'span',

  commands(editor) {
    return {
      setTextColor(color) {
        if (color === 'inherit' || !color) {
          document.execCommand('removeFormat');
        } else {
          document.execCommand('foreColor', false, color);
          // execCommand wraps in <font> — convert to span for cleanliness
          _fontToSpan(editor.content, 'color');
        }
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'textColor',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" width="16" height="16">
      <text x="3" y="17" font-size="15" font-weight="700" fill="currentColor" font-family="serif">A</text>
      <rect x="3" y="19" width="15" height="3" rx="1" fill="var(--rune-indicator-color, #1a1a1a)"/>
    </svg>`,
    title: 'Text Color',
    indicator: true,
    defaultColor: '#1a1a1a',

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
      const title = el('div', { class: 'rune-panel-section-label' }, 'TEXT COLOR');
      wrap.appendChild(title);
      const grid = el('div', { class: 'rune-panel-color-grid' });
      for (const c of TEXT_COLORS) {
        const swatch = el('button', { class: 'rune-color-swatch', type: 'button', title: c.label });
        swatch.style.background = c.swatch;
        if (c.value === 'inherit') {
          swatch.classList.add('is-default');
          swatch.textContent = 'A';
          swatch.style.background = '';
        }
        swatch.addEventListener('mousedown', (e) => {
          e.preventDefault();
          restoreSelection();
          editor.cmd('setTextColor', c.value);
          if (item._indicatorEl) {
            item._indicatorEl.style.background = c.value === 'inherit' ? '#1a1a1a' : c.swatch;
            item._el.style.setProperty('--rune-indicator-color', c.value === 'inherit' ? '#1a1a1a' : c.swatch);
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

// Convert <font color="..."> → <span style="color:...">
function _fontToSpan(root, attr) {
  root.querySelectorAll('font[color]').forEach(font => {
    const span = document.createElement('span');
    span.style.color = font.getAttribute('color');
    span.innerHTML = font.innerHTML;
    font.replaceWith(span);
  });
}
