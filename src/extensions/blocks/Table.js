import { uid } from '../../utils/id.js';

export const Table = {
  name: 'table',
  type: 'block',
  tag: 'table',

  commands(editor) {
    let _ctxMenu = null;

    // ── Tab navigation ──────────────────────────────────────────
    editor.events.on('keydown', ({ event: e }) => {
      if (e.key !== 'Tab') return;
      const cell = _getCursorCell();
      if (!cell) return;
      e.preventDefault();

      const table = cell.closest('table.rune-table');
      if (!table) return;
      const allCells = [...table.querySelectorAll('th, td')];
      const idx = allCells.indexOf(cell);

      if (e.shiftKey) {
        if (idx > 0) _focusCell(allCells[idx - 1]);
      } else {
        if (idx < allCells.length - 1) {
          _focusCell(allCells[idx + 1]);
        } else {
          _addRowAtEnd(table);
        }
      }
    });

    // ── Context menu ────────────────────────────────────────────
    editor.content.addEventListener('contextmenu', (e) => {
      const cell = e.target.closest?.('table.rune-table th, table.rune-table td');
      if (!cell) return;
      e.preventDefault();
      _showCtxMenu(cell, e.clientX, e.clientY);
    });

    const _onDocMousedown = (e) => {
      if (_ctxMenu && !_ctxMenu.contains(e.target)) _closeCtxMenu();
    };
    document.addEventListener('mousedown', _onDocMousedown);

    // Clean up on editor destroy
    editor.events.on('destroy', () => {
      document.removeEventListener('mousedown', _onDocMousedown);
      _closeCtxMenu();
    });

    return {
      insertTable(rows = 3, cols = 3) {
        editor.history.saveNow();
        const table = _buildTable(rows, cols);

        const currentBlock = editor.selection.getBlock();
        const after = currentBlock?.nextSibling || null;
        if (currentBlock && currentBlock.textContent.trim() === '') {
          editor.content.replaceChild(table, currentBlock);
        } else {
          editor.content.insertBefore(table, after);
        }

        // Ensure a paragraph after the table for continued typing
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        editor.content.insertBefore(p, table.nextSibling);

        _focusCell(table.querySelector('th, td'));
        editor._notifyChange();
      },
    };

    // ── Private helpers (hoisted) ───────────────────────────────

    function _getCursorCell() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      let node = sel.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      return node?.closest?.('table.rune-table th, table.rune-table td') || null;
    }

    function _focusCell(cell) {
      if (!cell) return;
      const range = document.createRange();
      range.selectNodeContents(cell);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function _buildTable(rows, cols) {
      const table = document.createElement('table');
      table.className = 'rune-table';
      table.setAttribute('data-type', 'table');
      table.setAttribute('data-id', uid());

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const th = document.createElement('th');
        th.className = 'rune-table-cell';
        th.innerHTML = '<br>';
        headerRow.appendChild(th);
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (let r = 0; r < rows - 1; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
          const td = document.createElement('td');
          td.className = 'rune-table-cell';
          td.innerHTML = '<br>';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      return table;
    }

    function _addRowAtEnd(table) {
      editor.history.saveNow();
      const rows = table.querySelectorAll('tr');
      const cols = rows[rows.length - 1]?.querySelectorAll('th, td').length || 3;
      const tbody = table.querySelector('tbody') || table;
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.className = 'rune-table-cell';
        td.innerHTML = '<br>';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
      _focusCell(tr.firstElementChild);
      editor._notifyChange();
    }

    function _closeCtxMenu() {
      if (!_ctxMenu) return;
      _ctxMenu.remove();
      _ctxMenu = null;
    }

    function _showCtxMenu(cell, x, y) {
      _closeCtxMenu();
      const menu = document.createElement('div');
      menu.className = 'rune-table-menu';

      const items = [
        { label: 'Insert row above',   fn: () => _insertRow(cell, 'before') },
        { label: 'Insert row below',   fn: () => _insertRow(cell, 'after')  },
        null,
        { label: 'Insert column left',  fn: () => _insertCol(cell, 'before') },
        { label: 'Insert column right', fn: () => _insertCol(cell, 'after')  },
        null,
        { label: 'Delete row',    fn: () => _deleteRow(cell), danger: true },
        { label: 'Delete column', fn: () => _deleteCol(cell), danger: true },
        null,
        { label: 'Delete table',  fn: () => _deleteTable(cell), danger: true },
      ];

      for (const item of items) {
        if (item === null) {
          const div = document.createElement('div');
          div.className = 'rune-table-menu-divider';
          menu.appendChild(div);
          continue;
        }
        const btn = document.createElement('button');
        btn.className = 'rune-table-menu-item' + (item.danger ? ' is-danger' : '');
        btn.type = 'button';
        btn.textContent = item.label;
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          item.fn();
          _closeCtxMenu();
        });
        menu.appendChild(btn);
      }

      document.body.appendChild(menu);
      _ctxMenu = menu;

      // Position (flip if near viewport edge)
      requestAnimationFrame(() => {
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        let left = x + 4;
        let top  = y + 4;
        if (left + menu.offsetWidth  > vw - 8) left = x - menu.offsetWidth  - 4;
        if (top  + menu.offsetHeight > vh - 8) top  = y - menu.offsetHeight - 4;
        menu.style.left = `${left}px`;
        menu.style.top  = `${top}px`;
        menu.classList.add('is-open');
      });
    }

    function _insertRow(cell, where) {
      editor.history.saveNow();
      const row  = cell.closest('tr');
      const cols = row.querySelectorAll('th, td').length;
      const newRow = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.className = 'rune-table-cell';
        td.innerHTML = '<br>';
        newRow.appendChild(td);
      }
      row.parentNode.insertBefore(newRow, where === 'before' ? row : row.nextSibling);
      editor._notifyChange();
    }

    function _insertCol(cell, where) {
      editor.history.saveNow();
      const row      = cell.closest('tr');
      const rowCells = [...row.querySelectorAll('th, td')];
      const colIdx   = rowCells.indexOf(cell);
      const table    = cell.closest('table');

      [...table.querySelectorAll('tr')].forEach(tr => {
        const cells  = [...tr.querySelectorAll('th, td')];
        const refCell = cells[colIdx];
        const isHead  = !!tr.closest('thead');
        const newCell = document.createElement(isHead ? 'th' : 'td');
        newCell.className = 'rune-table-cell';
        newCell.innerHTML = '<br>';
        tr.insertBefore(newCell, where === 'before' ? refCell : refCell?.nextSibling ?? null);
      });
      editor._notifyChange();
    }

    function _deleteRow(cell) {
      const table = cell.closest('table');
      const allRows = [...table.querySelectorAll('tr')];
      if (allRows.length <= 1) { _deleteTable(cell); return; }
      editor.history.saveNow();
      const tr = cell.closest('tr');
      const inHead = !!tr.closest('thead');
      tr.remove();
      // Removing the header row would leave an empty <thead> and make the first
      // data row render/export as the header. Promote the first body row to head.
      if (inHead) {
        const thead = table.querySelector('thead');
        const firstBodyRow = table.querySelector('tbody')?.querySelector('tr');
        if (thead && thead.querySelectorAll('tr').length === 0) {
          if (firstBodyRow) {
            [...firstBodyRow.children].forEach((c) => {
              if (c.tagName === 'TD') {
                const th = document.createElement('th');
                th.className = c.className;
                while (c.firstChild) th.appendChild(c.firstChild);
                c.replaceWith(th);
              }
            });
            thead.appendChild(firstBodyRow);
          } else {
            thead.remove();
          }
        }
      }
      editor._notifyChange();
    }

    function _deleteCol(cell) {
      const table    = cell.closest('table');
      const row      = cell.closest('tr');
      const rowCells = [...row.querySelectorAll('th, td')];
      if (rowCells.length <= 1) { _deleteTable(cell); return; }
      const colIdx = rowCells.indexOf(cell);
      editor.history.saveNow();
      [...table.querySelectorAll('tr')].forEach(tr => {
        [...tr.querySelectorAll('th, td')][colIdx]?.remove();
      });
      editor._notifyChange();
    }

    function _deleteTable(cell) {
      editor.history.saveNow();
      const table = cell.closest('table');
      const prev  = table.previousElementSibling;
      table.remove();
      if (editor.content.children.length === 0) editor._ensureContent();
      if (prev) editor.selection.setAtEnd(prev);
      editor._notifyChange();
    }
  },

  toolbarItem: {
    name: 'table',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3"  y1="9"  x2="21" y2="9"/>
      <line x1="3"  y1="15" x2="21" y2="15"/>
      <line x1="9"  y1="3"  x2="9"  y2="21"/>
      <line x1="15" y1="3"  x2="15" y2="21"/>
    </svg>`,
    title: 'Insert Table',
    action: 'insertTable',
    isActive: (editor) => {
      const block = editor.selection.getBlock();
      return block?.tagName?.toLowerCase() === 'table';
    },
  },

  slashItem: {
    icon: '⊞',
    title: 'Table',
    description: 'Insert a table with rows and columns',
    action: (editor) => editor.cmd('insertTable', 3, 3),
  },
};
