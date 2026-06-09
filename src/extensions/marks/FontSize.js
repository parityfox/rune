import { el } from '../../utils/dom.js';

const SIZES = [
  { label: 'Small',    value: '0.8em',  px: 13 },
  { label: 'Normal',   value: '1em',    px: 16 },
  { label: 'Medium',   value: '1.15em', px: 18 },
  { label: 'Large',    value: '1.4em',  px: 22 },
  { label: 'X-Large',  value: '1.75em', px: 28 },
  { label: 'Huge',     value: '2.25em', px: 36 },
];

export const FontSize = {
  name: 'fontSize',
  type: 'mark',
  tag: 'span',
  hasMark: (el) => el.tagName === 'SPAN' && !!el.style.fontSize,

  commands(editor) {
    return {
      setFontSize(size) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        // Extract selection HTML, wrap in span
        const frag = range.extractContents();
        const div  = document.createElement('div');
        div.appendChild(frag);
        const span = document.createElement('span');
        span.style.fontSize = size;
        span.innerHTML = div.innerHTML;
        range.insertNode(span);
        // Re-select the inserted span
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(newRange);
        editor._notifyChange();
      },
      clearFontSize() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        // Extract → modify within the fragment (always an element) → re-insert
        const frag = range.extractContents();
        frag.querySelectorAll('span[style*="font-size"]').forEach(s => {
          s.style.fontSize = '';
          if (!s.getAttribute('style')?.trim()) s.replaceWith(...s.childNodes);
        });
        range.insertNode(frag);
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'fontSize',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <text x="2" y="17" font-size="14" font-weight="700" fill="currentColor" stroke="none" font-family="serif">A</text>
      <text x="13" y="19" font-size="9" font-weight="400" fill="currentColor" stroke="none" font-family="serif">A</text>
    </svg>`,
    title: 'Font Size',
    indicator: false,

    renderPanel(editor, close) {
      // Capture the selection now — it's still intact when the panel opens.
      // Typing into the px input will blur the editor and lose the range,
      // so we restore it before applying the size.
      let savedRange = null;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }

      const restoreSelection = () => {
        if (!savedRange) return;
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(savedRange);
      };

      const wrap = el('div', { class: 'rune-panel-fontsize' });

      // Named sizes (em-based)
      for (const size of SIZES) {
        const row = el('button', { class: 'rune-panel-size-item', type: 'button' });
        const label = el('span', { class: 'rune-panel-size-label' }, size.label);
        const right = el('span', { class: 'rune-panel-size-right' });
        const pxHint = el('span', { class: 'rune-panel-size-px' }, `${size.px}px`);
        const preview = el('span', { class: 'rune-panel-size-preview' }, 'Aa');
        preview.style.fontSize = size.value;
        right.appendChild(pxHint);
        right.appendChild(preview);
        row.appendChild(label);
        row.appendChild(right);
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          restoreSelection();
          editor.cmd('setFontSize', size.value);
          close();
        });
        wrap.appendChild(row);
      }

      // Custom px input
      const divider = el('div', { class: 'rune-panel-size-divider' });
      const customRow = el('div', { class: 'rune-panel-size-custom' });
      const input = el('input', {
        type: 'number',
        class: 'rune-panel-input rune-panel-size-input',
        placeholder: 'px',
        min: '6',
        max: '200',
      });
      const applyBtn = el('button', { class: 'rune-panel-btn-primary', type: 'button' }, 'Apply');

      const applyPx = () => {
        const val = parseInt(input.value, 10);
        if (val >= 6 && val <= 200) {
          restoreSelection();
          editor.cmd('setFontSize', `${val}px`);
          close();
        }
      };
      applyBtn.addEventListener('mousedown', (e) => { e.preventDefault(); applyPx(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyPx(); } });

      customRow.appendChild(input);
      customRow.appendChild(applyBtn);
      wrap.appendChild(divider);
      wrap.appendChild(customRow);
      return wrap;
    },

    isActive: (editor) => editor.isActive('fontSize'),
  },
};
