import { el } from '../../utils/dom.js';

const LINE_HEIGHTS = [
  { label: 'Compact',  value: '1',    display: '1.0' },
  { label: 'Snug',     value: '1.25', display: '1.25' },
  { label: 'Normal',   value: '1.5',  display: '1.5' },
  { label: 'Relaxed',  value: '1.75', display: '1.75' },
  { label: 'Loose',    value: '2',    display: '2.0' },
];

export const LineHeight = {
  name: 'lineHeight',
  type: 'formatting',

  commands(editor) {
    return {
      setLineHeight(value) {
        const block = editor.selection.getBlock();
        if (!block) return;
        editor.history.saveNow();
        block.style.lineHeight = value;
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'lineHeight',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="9"  y1="6"  x2="20" y2="6"/>
      <line x1="9"  y1="12" x2="20" y2="12"/>
      <line x1="9"  y1="18" x2="20" y2="18"/>
      <polyline points="4 8 2 6 4 4" stroke-width="1.5"/>
      <polyline points="4 16 2 18 4 20" stroke-width="1.5"/>
    </svg>`,
    title: 'Line Height',
    indicator: false,

    renderPanel(editor, close) {
      const wrap = el('div', { class: 'rune-panel-lineheight' });
      const label = el('div', { class: 'rune-panel-section-label' }, 'LINE HEIGHT');
      wrap.appendChild(label);

      const block = editor.selection.getBlock();
      const cur = block?.style.lineHeight || '';

      for (const lh of LINE_HEIGHTS) {
        const btn = el('button', { class: 'rune-panel-lh-item', type: 'button' });
        if (cur === lh.value) btn.classList.add('is-active');

        const nameEl = el('span', { class: 'rune-panel-lh-label' }, lh.label);
        const valEl  = el('span', { class: 'rune-panel-lh-value' }, lh.display);
        btn.appendChild(nameEl);
        btn.appendChild(valEl);

        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          editor.cmd('setLineHeight', lh.value);
          close();
        });
        wrap.appendChild(btn);
      }
      return wrap;
    },

    isActive: () => false,
  },
};
