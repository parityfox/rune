import { el } from '../../utils/dom.js';

const ALIGNMENTS = [
  {
    value: 'left',
    label: 'Align Left',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3" y1="5" x2="21" y2="5"/>
      <line x1="3" y1="10" x2="14" y2="10"/>
      <line x1="3" y1="15" x2="17" y2="15"/>
      <line x1="3" y1="20" x2="21" y2="20"/>
    </svg>`,
  },
  {
    value: 'center',
    label: 'Align Center',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3" y1="5" x2="21" y2="5"/>
      <line x1="7" y1="10" x2="17" y2="10"/>
      <line x1="5" y1="15" x2="19" y2="15"/>
      <line x1="3" y1="20" x2="21" y2="20"/>
    </svg>`,
  },
  {
    value: 'right',
    label: 'Align Right',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3" y1="5" x2="21" y2="5"/>
      <line x1="10" y1="10" x2="21" y2="10"/>
      <line x1="7" y1="15" x2="21" y2="15"/>
      <line x1="3" y1="20" x2="21" y2="20"/>
    </svg>`,
  },
  {
    value: 'justify',
    label: 'Justify',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3" y1="5" x2="21" y2="5"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="3" y1="20" x2="17" y2="20"/>
    </svg>`,
  },
];

export const TextAlign = {
  name: 'textAlign',
  type: 'formatting',

  commands(editor) {
    return {
      setTextAlign(align) {
        const block = editor.selection.getFormattingTarget();
        if (!block) return;
        editor.history.saveNow();
        block.style.textAlign = (align === 'left') ? '' : align;
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'textAlign',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3" y1="5" x2="21" y2="5"/>
      <line x1="3" y1="10" x2="14" y2="10"/>
      <line x1="3" y1="15" x2="17" y2="15"/>
      <line x1="3" y1="20" x2="21" y2="20"/>
    </svg>`,
    title: 'Text Align',
    indicator: false,

    renderPanel(editor, close) {
      const wrap = el('div', { class: 'rune-panel-align' });
      const label = el('div', { class: 'rune-panel-section-label' }, 'ALIGNMENT');
      wrap.appendChild(label);

      const block = editor.selection.getFormattingTarget();
      const cur = block?.style.textAlign || 'left';

      const row = el('div', { class: 'rune-panel-align-row' });
      for (const a of ALIGNMENTS) {
        const btn = el('button', { class: 'rune-panel-align-btn', type: 'button', title: a.label });
        btn.innerHTML = a.icon;
        const isSelected = (cur === a.value) || (cur === '' && a.value === 'left');
        if (isSelected) btn.classList.add('is-active');

        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          editor.cmd('setTextAlign', a.value);
          close();
        });
        row.appendChild(btn);
      }
      wrap.appendChild(row);
      return wrap;
    },

    isActive(editor) {
      const block = editor.selection.getFormattingTarget();
      const align = block?.style.textAlign;
      return !!(align && align !== '' && align !== 'left');
    },
  },
};
