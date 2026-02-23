import { el } from '../../utils/dom.js';

// Per-editor WeakMap so the static keymap can reference the open function
const _openers = new WeakMap();

export const FindReplace = {
  name: 'findReplace',
  type: 'plugin',

  keymap: {
    'Meta+f':    (editor) => _openers.get(editor)?.(),
    'Control+f': (editor) => _openers.get(editor)?.(),
  },

  init(editor) {
    let _panel   = null;
    let _matches = [];
    let _current = -1;
    let _query   = '';
    let _countEl = null;

    // ── Open / close ────────────────────────────────────────────

    function _open() {
      if (_panel) { _panel.querySelector('.rune-fr-find').focus(); return; }
      _panel = _buildPanel();
      document.body.appendChild(_panel);
      requestAnimationFrame(() => _panel.classList.add('is-open'));
      _panel.querySelector('.rune-fr-find').focus();
    }

    function _close() {
      _clearHighlights();
      _panel?.classList.remove('is-open');
      const p = _panel;
      _panel = null;
      _matches = [];
      _current = -1;
      _query   = '';
      setTimeout(() => p?.remove(), 150);
    }

    _openers.set(editor, _open);

    // ── Patch getHtml to strip search marks ─────────────────────
    const _origGetHtml = editor.getHtml.bind(editor);
    editor.getHtml = () => {
      if (!_panel) return _origGetHtml();
      const clone = editor.content.cloneNode(true);
      clone.querySelectorAll('mark.rune-search-match').forEach(m => {
        while (m.firstChild) m.parentNode.insertBefore(m.firstChild, m);
        m.remove();
      });
      return clone.innerHTML;
    };

    // ── Re-highlight when content changes ───────────────────────
    editor.events.on('change', () => {
      if (!_panel || !_query) return;
      _clearHighlights();
      _batchHighlight(_query);
      _updateCount();
    });

    // ── Panel builder ────────────────────────────────────────────

    function _buildPanel() {
      const panel = el('div', { class: 'rune-fr-panel' });

      // Find row
      const findRow  = el('div', { class: 'rune-fr-row' });
      const findInput = el('input', { class: 'rune-fr-find rune-fr-input', type: 'text', placeholder: 'Find…' });
      _countEl = el('span', { class: 'rune-fr-count' });

      const prevBtn = el('button', { class: 'rune-fr-btn', type: 'button', title: 'Previous (Shift+Enter)' });
      prevBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><polyline points="18 15 12 9 6 15"/></svg>`;
      const nextBtn = el('button', { class: 'rune-fr-btn', type: 'button', title: 'Next (Enter)' });
      nextBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><polyline points="6 9 12 15 18 9"/></svg>`;
      const closeBtn = el('button', { class: 'rune-fr-btn rune-fr-close', type: 'button', title: 'Close (Esc)' });
      closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

      findRow.append(findInput, _countEl, prevBtn, nextBtn, closeBtn);

      // Replace row
      const replRow    = el('div', { class: 'rune-fr-row' });
      const replInput  = el('input', { class: 'rune-fr-replace rune-fr-input', type: 'text', placeholder: 'Replace with…' });
      const replBtn    = el('button', { class: 'rune-fr-btn rune-fr-btn--text', type: 'button' }, 'Replace');
      const replAllBtn = el('button', { class: 'rune-fr-btn rune-fr-btn--text', type: 'button' }, 'All');

      replRow.append(replInput, replBtn, replAllBtn);
      panel.append(findRow, replRow);

      // ── Events ─────────────────────────────────────────────────

      findInput.addEventListener('input', () => {
        _query = findInput.value;
        _clearHighlights();
        _batchHighlight(_query);
        _updateCount();
      });

      findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); e.shiftKey ? _step(-1) : _step(1); _updateCount(); }
        if (e.key === 'Escape') { _close(); }
      });

      replInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') _close();
      });

      prevBtn.addEventListener('mousedown',   (e) => { e.preventDefault(); _step(-1); _updateCount(); });
      nextBtn.addEventListener('mousedown',   (e) => { e.preventDefault(); _step(1);  _updateCount(); });
      closeBtn.addEventListener('mousedown',  (e) => { e.preventDefault(); _close(); });

      replBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        _replaceCurrent(replInput.value);
        _batchHighlight(_query);
        _updateCount();
      });

      replAllBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        _replaceAll(replInput.value);
        _batchHighlight(_query);
        _updateCount();
      });

      return panel;
    }

    // ── Search & highlight ───────────────────────────────────────

    function _batchHighlight(query) {
      _matches = [];
      _current = -1;
      if (!query.trim()) return;

      // Collect all text nodes before any DOM modification
      const textNodes = [];
      const walker = document.createTreeWalker(
        editor.content,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (node.parentElement?.tagName === 'MARK') return NodeFilter.FILTER_REJECT;
            if (!node.textContent) return NodeFilter.FILTER_SKIP;
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );
      let node;
      while ((node = walker.nextNode())) textNodes.push(node);

      const qLower = query.toLowerCase();
      for (const textNode of textNodes) {
        _matches.push(..._highlightTextNode(textNode, qLower));
      }

      if (_matches.length > 0) {
        _current = 0;
        _activateMatch(0);
      }
    }

    function _highlightTextNode(textNode, qLower) {
      const text  = textNode.textContent;
      const lower = text.toLowerCase();
      const positions = [];
      let pos = 0, idx;
      while ((idx = lower.indexOf(qLower, pos)) !== -1) {
        positions.push({ start: idx, end: idx + qLower.length });
        pos = idx + 1;
      }
      if (positions.length === 0) return [];

      const parent   = textNode.parentNode;
      const fragment = document.createDocumentFragment();
      const marks    = [];
      let lastIdx    = 0;

      for (const { start, end } of positions) {
        if (start > lastIdx) fragment.appendChild(document.createTextNode(text.slice(lastIdx, start)));
        const mark = document.createElement('mark');
        mark.className  = 'rune-search-match';
        mark.textContent = text.slice(start, end);
        fragment.appendChild(mark);
        marks.push(mark);
        lastIdx = end;
      }
      if (lastIdx < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIdx)));

      parent.replaceChild(fragment, textNode);
      return marks;
    }

    function _clearHighlights() {
      const marks = [...editor.content.querySelectorAll('mark.rune-search-match')];
      for (const mark of marks) {
        const parent = mark.parentNode;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      }
      _matches = [];
      _current = -1;
    }

    function _activateMatch(idx) {
      _matches.forEach(m => m.classList.remove('is-active'));
      const mark = _matches[idx];
      if (!mark) return;
      mark.classList.add('is-active');
      mark.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function _step(dir) {
      if (_matches.length === 0) return;
      _current = (_current + dir + _matches.length) % _matches.length;
      _activateMatch(_current);
    }

    function _updateCount() {
      if (!_countEl) return;
      _countEl.textContent = _matches.length === 0
        ? (_query ? '0/0' : '')
        : `${_current + 1}/${_matches.length}`;
    }

    // ── Replace ──────────────────────────────────────────────────

    function _replaceCurrent(replacement) {
      if (_current < 0 || _current >= _matches.length) return;
      editor.history.saveNow();
      const mark = _matches[_current];
      mark.parentNode.replaceChild(document.createTextNode(replacement), mark);
      _matches.splice(_current, 1);
      if (_current >= _matches.length) _current = _matches.length - 1;
      editor._notifyChange();
    }

    function _replaceAll(replacement) {
      if (_matches.length === 0) return;
      editor.history.saveNow();
      for (const mark of [..._matches]) {
        mark.parentNode.replaceChild(document.createTextNode(replacement), mark);
      }
      _matches = [];
      _current = -1;
      editor._notifyChange();
    }
  },
};
