import { uid } from '../../utils/id.js';

export const TaskList = {
  name: 'taskList',
  type: 'block',
  tag: 'ul',  // shares tag with BulletList — resolved by match function
  match: (el) => el.classList.contains('rune-task-list'),

  commands(editor) {
    // Toggle checkbox on click
    editor.content.addEventListener('mousedown', (e) => {
      const cb = e.target.closest('.rune-task-checkbox');
      if (!cb) return;
      e.preventDefault();
      const li = cb.closest('.rune-task-item');
      if (!li) return;
      const checked = li.dataset.checked === 'true';
      li.dataset.checked = checked ? 'false' : 'true';
      cb.textContent = checked ? '☐' : '☑';
      editor._notifyChange();
    });

    // Enter / Backspace inside task list
    editor.events.on('keydown', ({ event: e }) => {
      const block = editor.selection.getBlock();
      if (!block?.classList.contains('rune-task-list')) return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const li = window.getSelection()?.anchorNode?.parentElement?.closest('li.rune-task-item');
        if (li && li.querySelector('.rune-task-content')?.textContent.trim() === '') {
          // Empty item — exit the list, create paragraph after
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          editor.content.insertBefore(p, block.nextSibling || null);
          li.remove();
          if (!block.querySelector('li')) block.remove();
          editor.selection.setAtStart(p);
        } else {
          // Add new task item
          const newLi = _makeTaskItem('');
          const currentLi = window.getSelection()?.anchorNode?.parentElement?.closest('li.rune-task-item');
          if (currentLi) {
            currentLi.after(newLi);
          } else {
            block.appendChild(newLi);
          }
          const content = newLi.querySelector('.rune-task-content');
          editor.selection.setAtStart(content);
        }
        editor._notifyChange();
      }

      if (e.key === 'Backspace') {
        const sel = window.getSelection();
        const li = sel?.anchorNode?.parentElement?.closest('li.rune-task-item');
        if (li && sel.isCollapsed && sel.anchorOffset === 0) {
          const content = li.querySelector('.rune-task-content');
          if (!content || content.textContent.trim() === '') {
            e.preventDefault();
            const prev = li.previousElementSibling;
            li.remove();
            if (!block.querySelector('li')) {
              const p = document.createElement('p');
              p.innerHTML = '<br>';
              editor.content.replaceChild(p, block);
              editor.selection.setAtStart(p);
            } else if (prev) {
              editor.selection.setAtEnd(prev.querySelector('.rune-task-content') || prev);
            }
            editor._notifyChange();
          }
        }
      }
    });

    return {
      insertTaskList() {
        editor.history.saveNow();

        const ul = document.createElement('ul');
        ul.className = 'rune-task-list';
        ul.setAttribute('data-type', 'task-list');
        ul.setAttribute('data-id', uid());

        const li = _makeTaskItem('');
        ul.appendChild(li);

        const currentBlock = editor.selection.getBlock();
        if (currentBlock && currentBlock.textContent.trim() === '') {
          editor.content.replaceChild(ul, currentBlock);
        } else {
          const after = currentBlock?.nextSibling || null;
          editor.content.insertBefore(ul, after);
        }

        editor.selection.setAtStart(li.querySelector('.rune-task-content'));
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'taskList',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5"  width="4" height="4" rx="1"/>
      <rect x="3" y="11" width="4" height="4" rx="1"/>
      <rect x="3" y="17" width="4" height="4" rx="1"/>
      <line x1="10" y1="7"  x2="21" y2="7"/>
      <line x1="10" y1="13" x2="21" y2="13"/>
      <line x1="10" y1="19" x2="21" y2="19"/>
    </svg>`,
    title: 'Task List',
    action: 'insertTaskList',
    isActive: (editor) => editor.selection.getBlock()?.dataset?.type === 'task-list',
  },

  slashItem: {
    icon: '☑',
    title: 'Task List',
    description: 'Checklist of to-do items',
    action: (editor) => editor.cmd('insertTaskList'),
  },
};

function _makeTaskItem(text) {
  const li = document.createElement('li');
  li.className = 'rune-task-item';
  li.setAttribute('data-checked', 'false');

  const cb = document.createElement('span');
  cb.className = 'rune-task-checkbox';
  cb.setAttribute('contenteditable', 'false');
  cb.textContent = '☐';

  const content = document.createElement('span');
  content.className = 'rune-task-content';
  if (text) content.textContent = text;
  else content.innerHTML = '<br>';

  li.appendChild(cb);
  li.appendChild(content);
  return li;
}
