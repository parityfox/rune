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
    let _replacing = false;   // suppress change-driven re-highlight during a replace
    let _rehlTimer = null;    // debounce timer for change-driven re-highlight

    // ── Open / close ────────────────────────────────────────────

    function _open() {
      if (_panel) { _panel.querySelector('.rune-fr-find').focus(); return; }
      _panel = _buildPanel();
      document.body.appendChild(_panel);
      requestAnimationFrame(() => _panel.classList.add('is-open'));
      _panel.querySelector('.rune-fr-find').focus();
    }

    function _close() {
      clearTimeout(_rehlTimer);
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

    // Highlights live in the decoration overlay (not injected into the editable
    // tree), so getHtml()/getMarkdown() stay clean — no monkey-patching needed.

    // ── Re-search when content changes (debounced) ──────────────
    editor.events.on('change', () => {
      if (!_panel || !_query || _replacing) return;
      clearTimeout(_rehlTimer);
      _rehlTimer = setTimeout(() => {
        if (!_panel || !_query) return;
        const keep = _current;
        _search(_query);
        if (_matches.length) {
          _current = Math.min(Math.max(0, keep), _matches.length - 1);
          _renderDecos();
        }
        _updateCount();
      }, 150);
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
        _search(findInput.value);
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
        // In-place replace + offset shift advances to the next match without a
        // full re-scan (so navigation doesn't reset and replacements aren't
        // re-matched). #31, #32
        _replaceCurrent(replInput.value);
        _updateCount();
      });

      replAllBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        _replaceAll(replInput.value);
        _updateCount();
      });

      return panel;
    }

    // ── Search & highlight (decoration overlay, no DOM injection) ─

    // _matches are non-overlapping offset descriptors { node, start, end }.
    function _search(query) {
      _query = query;
      _matches = [];
      _current = -1;
      editor.decorations.clear('find');
      if (!query.trim()) return;

      const q = query.toLowerCase();
      const walker = document.createTreeWalker(editor.content, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.textContent ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
      });
      let node;
      while ((node = walker.nextNode())) {
        const lower = node.textContent.toLowerCase();
        let pos = 0, idx;
        while ((idx = lower.indexOf(q, pos)) !== -1) {
          _matches.push({ node, start: idx, end: idx + q.length });
          pos = idx + q.length;                    // non-overlapping
        }
      }
      if (_matches.length) _current = 0;
      _renderDecos();
      _scrollToActive();
    }

    function _matchRange(m) {
      const r = document.createRange();
      r.setStart(m.node, m.start);
      r.setEnd(m.node, m.end);
      return r;
    }

    function _renderDecos() {
      editor.decorations.clear('find');
      _matches.forEach((m, i) => {
        editor.decorations.addRange(_matchRange(m), {
          class: 'rune-search-match' + (i === _current ? ' is-active' : ''),
          type: 'find',
        });
      });
    }

    function _scrollToActive() {
      const m = _matches[_current];
      m?.node?.parentElement?.scrollIntoView?.({ block: 'nearest' });
    }

    function _clearHighlights() {
      editor.decorations.clear('find');
      _matches = [];
      _current = -1;
    }

    function _step(dir) {
      if (_matches.length === 0) return;
      _current = (_current + dir + _matches.length) % _matches.length;
      _renderDecos();
      _scrollToActive();
    }

    function _updateCount() {
      if (!_countEl) return;
      _countEl.textContent = _matches.length === 0
        ? (_query ? '0/0' : '')
        : `${_current + 1}/${_matches.length}`;
    }

    // ── Replace (in-place via replaceData; offsets shift, no node split) ─

    function _replaceCurrent(replacement) {
      if (_current < 0 || _current >= _matches.length) return;
      editor.history.saveNow();
      const m = _matches[_current];
      const len = m.end - m.start;
      m.node.replaceData(m.start, len, replacement);
      const delta = replacement.length - len;
      // Shift later matches in the same node past the replaced region.
      for (let j = _current + 1; j < _matches.length; j++) {
        if (_matches[j].node === m.node && _matches[j].start >= m.end) {
          _matches[j].start += delta;
          _matches[j].end += delta;
        }
      }
      _matches.splice(_current, 1);                // remove it; _current now points at the next
      if (_current >= _matches.length) _current = _matches.length - 1;
      _replacing = true;
      editor._notifyChange();
      _replacing = false;
      _renderDecos();
    }

    function _replaceAll(replacement) {
      if (_matches.length === 0) return;
      editor.history.saveNow();
      // Replace last-to-first so earlier offsets stay valid.
      for (let i = _matches.length - 1; i >= 0; i--) {
        const m = _matches[i];
        m.node.replaceData(m.start, m.end - m.start, replacement);
      }
      _matches = [];
      _current = -1;
      editor.decorations.clear('find');
      _replacing = true;
      editor._notifyChange();
      _replacing = false;
    }
  },
};
