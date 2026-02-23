import { el } from '../../utils/dom.js';

const FONTS = [
  { label: 'Default',         value: 'inherit',                             mono: false },
  { label: 'Inter',           value: "'Inter', sans-serif",                 mono: false },
  { label: 'Arial',           value: 'Arial, sans-serif',                   mono: false },
  { label: 'Georgia',         value: 'Georgia, serif',                      mono: false },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif",     mono: false },
  { label: 'Trebuchet MS',    value: "'Trebuchet MS', sans-serif",          mono: false },
  { label: 'Verdana',         value: 'Verdana, Geneva, sans-serif',         mono: false },
  { label: 'Courier New',     value: "'Courier New', Courier, monospace",   mono: true  },
  { label: 'JetBrains Mono',  value: "'JetBrains Mono', monospace",         mono: true  },
];

export const FontFamily = {
  name: 'fontFamily',
  type: 'mark',
  tag: 'span',

  commands(editor) {
    return {
      setFontFamily(family) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);

        if (family === 'inherit' || !family) {
          // Strip font-family from spans in selection
          const anc = range.commonAncestorContainer;
          const spans = (anc.querySelectorAll?.('span[style*="font-family"]') || []);
          spans.forEach(s => {
            s.style.fontFamily = '';
            if (!s.getAttribute('style').trim()) s.replaceWith(...s.childNodes);
          });
        } else {
          const frag = range.extractContents();
          const div  = document.createElement('div');
          div.appendChild(frag);
          const span = document.createElement('span');
          span.style.fontFamily = family;
          span.innerHTML = div.innerHTML;
          range.insertNode(span);
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'fontFamily',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <line x1="9" y1="20" x2="15" y2="20"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>`,
    title: 'Font Family',
    indicator: false,

    renderPanel(editor, close) {
      let savedRange = null;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
      const restoreSelection = () => {
        if (!savedRange) return;
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(savedRange);
      };

      const wrap = el('div', { class: 'rune-panel-fontfamily' });

      for (const font of FONTS) {
        const btn = el('button', { class: 'rune-panel-font-item', type: 'button' });
        const name = el('span', { class: 'rune-panel-font-name' }, font.label);
        const preview = el('span', { class: 'rune-panel-font-preview' }, 'Abc');
        if (font.value !== 'inherit') preview.style.fontFamily = font.value;
        btn.appendChild(name);
        btn.appendChild(preview);
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          restoreSelection();
          editor.cmd('setFontFamily', font.value);
          close();
        });
        wrap.appendChild(btn);
      }

      return wrap;
    },

    isActive: () => false,
  },
};
