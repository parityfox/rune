import { uid } from '../../utils/id.js';
import { el } from '../../utils/dom.js';

const PLUS_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

export const Table = {
  name: 'table',
  type: 'block',
  tag: 'table',

  commands(editor) {
    let _ctxMenu = null;

    // ── Tab navigation ──────────────────────────────────────────
    const _onKeydown = ({ event: e }) => {
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
    };
    editor.events.on('keydown', _onKeydown);

    // ── Context menu ────────────────────────────────────────────
    const _onContextMenu = (e) => {
      const cell = e.target.closest?.('table.rune-table th, table.rune-table td');
      if (!cell) return;
      e.preventDefault();
      _showCtxMenu(cell, e.clientX, e.clientY);
    };
    editor.content.addEventListener('contextmenu', _onContextMenu);

    const _onDocMousedown = (e) => {
      if (_ctxMenu && !_ctxMenu.contains(e.target)) _closeCtxMenu();
    };
    document.addEventListener('mousedown', _onDocMousedown);

    // ── Discoverable controls ───────────────────────────────────
    // Edge "+" buttons (add column / row) appear on table hover; a small
    // toolbar with delete/insert actions appears when the caret is in a table.
    // All are position:fixed and anchored to the active table's bounding box.
    const addColBtn = _makeAddBtn('Add column');
    const addRowBtn = _makeAddBtn('Add row');
    const bar = _makeBar();
    for (const elm of [addColBtn, addRowBtn, bar]) {
      elm.style.display = 'none';
      document.body.appendChild(elm);
    }

    addColBtn.addEventListener('click', () => { if (addColBtn._table) { _addColAtEnd(addColBtn._table); _refresh(); } });
    addRowBtn.addEventListener('click', () => { if (addRowBtn._table) { _addRowAtEnd(addRowBtn._table); _refresh(); } });

    let _hoverTable = null;
    let _overControls = false;
    let _hideTimer = null;

    const _scheduleHide = () => {
      clearTimeout(_hideTimer);
      _hideTimer = setTimeout(() => { if (!_overControls) { _hoverTable = null; _refresh(); } }, 140);
    };

    const _onMouseover = (e) => {
      const t = e.target.closest?.('table.rune-table');
      if (t) { clearTimeout(_hideTimer); _hoverTable = t; _refresh(); }
    };
    const _onMouseout = (e) => {
      if (!e.relatedTarget?.closest?.('table.rune-table')) _scheduleHide();
    };
    editor.content.addEventListener('mouseover', _onMouseover);
    editor.content.addEventListener('mouseout', _onMouseout);
    for (const elm of [addColBtn, addRowBtn, bar]) {
      elm.addEventListener('mouseenter', () => { _overControls = true; clearTimeout(_hideTimer); });
      elm.addEventListener('mouseleave', () => { _overControls = false; _scheduleHide(); });
    }

    const _reposition = () => {
      if (bar.style.display !== 'none' || addColBtn.style.display !== 'none') _refresh();
    };
    editor.events.on('selectionchange', _refresh);
    editor.events.on('change', _refresh);
    window.addEventListener('scroll', _reposition, true);
    window.addEventListener('resize', _reposition);

    function _refresh() {
      const caretTable = _getCursorCell()?.closest('table.rune-table') || null;
      const plusTable = (caretTable && editor.content.contains(caretTable)) ? caretTable
        : (_hoverTable && editor.content.contains(_hoverTable)) ? _hoverTable
        : null;

      if (plusTable) {
        _positionEdgeBtns(plusTable);
        addColBtn._table = plusTable; addRowBtn._table = plusTable;
        addColBtn.style.display = ''; addRowBtn.style.display = '';
      } else {
        addColBtn.style.display = 'none'; addRowBtn.style.display = 'none';
      }

      if (caretTable && editor.content.contains(caretTable)) {
        _positionBar(caretTable);
        bar.style.display = '';
      } else {
        bar.style.display = 'none';
      }
    }

    // Clean up on editor destroy — including the editor.content listeners,
    // since a host may keep and reuse the content element after destroy().
    editor.events.on('destroy', () => {
      editor.events.off('keydown', _onKeydown);
      editor.events.off('selectionchange', _refresh);
      editor.events.off('change', _refresh);
      editor.content.removeEventListener('contextmenu', _onContextMenu);
      editor.content.removeEventListener('mouseover', _onMouseover);
      editor.content.removeEventListener('mouseout', _onMouseout);
      document.removeEventListener('mousedown', _onDocMousedown);
      window.removeEventListener('scroll', _reposition, true);
      window.removeEventListener('resize', _reposition);
      clearTimeout(_hideTimer);
      addColBtn.remove(); addRowBtn.remove(); bar.remove();
      _closeCtxMenu();
    });

    return {
      insertTable(rows = 3, cols = 3) {
        editor.history.saveNow();
        const table = _buildTable(rows, cols);

        // The current block may live inside a container region (toggle body /
        // column), so insert relative to its parent, not editor.content.
        const currentBlock = editor.selection.getBlock();
        const parent = currentBlock?.parentNode || editor.content;
        if (currentBlock && currentBlock.textContent.trim() === '') {
          parent.replaceChild(table, currentBlock);
        } else if (currentBlock) {
          parent.insertBefore(table, currentBlock.nextSibling);
        } else {
          editor.content.appendChild(table);
        }

        // Ensure a paragraph after the table for continued typing
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        parent.insertBefore(p, table.nextSibling);

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

    function _makeAddBtn(label) {
      const btn = el('button', { class: 'rune-table-add-btn', type: 'button', title: label, 'aria-label': label });
      btn.innerHTML = PLUS_ICON;
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      return btn;
    }

    function _makeBar() {
      const bar = el('div', { class: 'rune-table-bar', role: 'toolbar', 'aria-label': 'Table controls' });
      const add = (label, title, fn, danger) => {
        const btn = el('button', { class: 'rune-table-bar-btn' + (danger ? ' is-danger' : ''), type: 'button', title }, label);
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const cell = _getCursorCell();
          if (cell) { fn(cell); _refresh(); }
        });
        return btn;
      };
      bar.append(
        add('Col +', 'Insert column right', (c) => _insertCol(c, 'after')),
        add('Col −', 'Delete column', (c) => _deleteCol(c), true),
        el('span', { class: 'rune-table-bar-sep' }),
        add('Row +', 'Insert row below', (c) => _insertRow(c, 'after')),
        add('Row −', 'Delete row', (c) => _deleteRow(c), true),
        el('span', { class: 'rune-table-bar-sep' }),
        add('✕', 'Delete table', (c) => _deleteTable(c), true),
      );
      return bar;
    }

    function _positionEdgeBtns(table) {
      const r = table.getBoundingClientRect();
      addColBtn.style.left = `${r.right - 11}px`;
      addColBtn.style.top  = `${r.top + r.height / 2 - 11}px`;
      addRowBtn.style.left = `${r.left + r.width / 2 - 11}px`;
      addRowBtn.style.top  = `${r.bottom - 11}px`;
    }

    function _positionBar(table) {
      const r = table.getBoundingClientRect();
      const bw = bar.offsetWidth || 220;
      let top = r.top - 38;
      if (top < 8) top = r.bottom + 6;
      bar.style.left = `${Math.max(8, r.right - bw)}px`;
      bar.style.top  = `${top}px`;
    }

    function _addColAtEnd(table) {
      editor.history.saveNow();
      [...table.querySelectorAll('tr')].forEach((tr) => {
        const isHead = !!tr.closest('thead');
        const cell = document.createElement(isHead ? 'th' : 'td');
        cell.className = 'rune-table-cell';
        cell.innerHTML = '<br>';
        tr.appendChild(cell);
      });
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
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3"  y1="9"  x2="21" y2="9"/>
      <line x1="3"  y1="15" x2="21" y2="15"/>
      <line x1="9"  y1="3"  x2="9"  y2="21"/>
      <line x1="15" y1="3"  x2="15" y2="21"/>
    </svg>`,
    title: 'Insert Table',
    indicator: false,

    // A hoverable grid for picking the table size up front (Notion-style).
    renderPanel(editor, close) {
      const MAX_R = 8, MAX_C = 8;
      const wrap  = el('div', { class: 'rune-table-picker' });
      const grid  = el('div', { class: 'rune-table-grid' });
      const label = el('div', { class: 'rune-table-picker-label' }, 'Pick a size');

      const cells = [];
      for (let r = 0; r < MAX_R; r++) {
        for (let c = 0; c < MAX_C; c++) {
          const cell = el('div', { class: 'rune-table-grid-cell', 'data-r': String(r), 'data-c': String(c) });
          grid.appendChild(cell);
          cells.push(cell);
        }
      }

      const highlight = (rr, cc) => {
        for (const cell of cells) {
          const on = (+cell.dataset.r <= rr) && (+cell.dataset.c <= cc);
          cell.classList.toggle('is-on', on);
        }
        label.textContent = `${cc + 1} × ${rr + 1}`;
      };

      grid.addEventListener('mousemove', (e) => {
        const cell = e.target.closest('.rune-table-grid-cell');
        if (cell) highlight(+cell.dataset.r, +cell.dataset.c);
      });
      grid.addEventListener('mousedown', (e) => {
        const cell = e.target.closest('.rune-table-grid-cell');
        if (!cell) return;
        e.preventDefault();
        editor.cmd('insertTable', +cell.dataset.r + 1, +cell.dataset.c + 1);
        close();
      });

      wrap.append(grid, label);
      return wrap;
    },

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
