import { uid } from '../../utils/id.js';

/**
 * Toggle — a collapsible section: a clickable arrow + title, and a body that
 * holds block children. The body is a container region, so block commands work
 * inside it (see Selection.getBlock). Collapse state is the `is-open` class.
 */
export const Toggle = {
  name: 'toggle',
  type: 'block',
  tag: 'div',
  match: (el) => el.dataset?.type === 'toggle',

  commands(editor) {
    // Click the arrow to collapse / expand.
    editor.content.addEventListener('click', (e) => {
      const arrow = e.target.closest?.('.rune-toggle-arrow');
      if (!arrow) return;
      e.preventDefault();
      arrow.closest('.rune-toggle')?.classList.toggle('is-open');
      editor._notifyChange();
    });

    // Enter at the end of the title drops the caret into the body.
    editor.events.on('keydown', ({ event: e }) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      const sel = window.getSelection();
      const at = sel?.anchorNode;
      const title = (at?.nodeType === 1 ? at : at?.parentElement)?.closest?.('.rune-toggle-title');
      if (!title) return;
      e.preventDefault();
      const toggle = title.closest('.rune-toggle');
      toggle?.classList.add('is-open');
      const first = toggle?.querySelector('.rune-toggle-body')?.firstElementChild;
      if (first) editor.selection.setAtStart(first);
    });

    return {
      insertToggle() {
        editor.history.saveNow();
        const wrap = _makeToggle();
        const cur = editor.selection.getBlock();
        if (cur && cur.parentNode === editor.content && cur.textContent.trim() === '') {
          editor.content.replaceChild(wrap, cur);
        } else if (cur && cur.parentNode === editor.content) {
          editor.content.insertBefore(wrap, cur.nextSibling);
        } else {
          editor.content.appendChild(wrap);
        }
        editor.selection.setAtEnd(wrap.querySelector('.rune-toggle-title'));
        editor._notifyChange();
      },
    };
  },

  slashItem: {
    icon: '▸',
    title: 'Toggle',
    description: 'Collapsible section',
    action: (editor) => editor.cmd('insertToggle'),
  },
};

function _makeToggle() {
  const wrap = document.createElement('div');
  wrap.className = 'rune-toggle is-open';
  wrap.setAttribute('data-type', 'toggle');
  wrap.setAttribute('data-id', uid());

  const summary = document.createElement('div');
  summary.className = 'rune-toggle-summary';
  const arrow = document.createElement('span');
  arrow.className = 'rune-toggle-arrow';
  arrow.setAttribute('contenteditable', 'false');
  arrow.textContent = '▸';
  const title = document.createElement('span');
  title.className = 'rune-toggle-title';
  title.innerHTML = '<br>';
  summary.append(arrow, title);

  const body = document.createElement('div');
  body.className = 'rune-toggle-body';
  const p = document.createElement('p');
  p.innerHTML = '<br>';
  body.appendChild(p);

  wrap.append(summary, body);
  return wrap;
}
