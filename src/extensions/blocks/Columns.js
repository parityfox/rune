import { uid } from '../../utils/id.js';

/**
 * Columns — a side-by-side multi-column layout. Each `.rune-column` is a
 * container region holding block children (so block commands work inside).
 */
export const Columns = {
  name: 'columns',
  type: 'block',
  tag: 'div',
  match: (el) => el.dataset?.type === 'columns',

  commands(editor) {
    return {
      insertColumns(count = 2) {
        editor.history.saveNow();
        const wrap = _makeColumns(Math.max(2, Math.min(4, count | 0)));
        const cur = editor.selection.getBlock();
        if (cur && cur.parentNode === editor.content && cur.textContent.trim() === '') {
          editor.content.replaceChild(wrap, cur);
        } else if (cur && cur.parentNode === editor.content) {
          editor.content.insertBefore(wrap, cur.nextSibling);
        } else {
          editor.content.appendChild(wrap);
        }
        editor.selection.setAtStart(wrap.querySelector('.rune-column > *'));
        editor._notifyChange();
      },
    };
  },

  slashItem: {
    icon: '▥',
    title: 'Columns',
    description: 'Side-by-side columns',
    action: (editor) => editor.cmd('insertColumns', 2),
  },
};

function _makeColumns(count) {
  const wrap = document.createElement('div');
  wrap.className = 'rune-columns';
  wrap.setAttribute('data-type', 'columns');
  wrap.setAttribute('data-id', uid());
  for (let i = 0; i < count; i++) {
    const col = document.createElement('div');
    col.className = 'rune-column';
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    col.appendChild(p);
    wrap.appendChild(col);
  }
  return wrap;
}
