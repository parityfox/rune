export const DragReorder = {
  name: 'dragReorder',
  type: 'plugin',

  init(editor) {
    let _targetBlock = null;
    let _dragging    = null;
    let _dropBlock   = null;
    let _dropPos     = 'after';
    let _active      = false; // true once drag threshold crossed
    let _startY      = 0;
    let _hideTimer   = null;
    let _moveRaf     = null;   // throttle move processing to one per frame
    let _lastMove    = null;
    let _pointerId   = null;
    let _dimming     = null;   // Animation dimming the dragged block

    // ── Floating elements ───────────────────────────────────────

    const _handle = document.createElement('div');
    _handle.className = 'rune-drag-handle';
    _handle.innerHTML = `<svg viewBox="0 0 10 16" fill="currentColor" width="10" height="16">
      <circle cx="3" cy="2"  r="1.4"/>
      <circle cx="7" cy="2"  r="1.4"/>
      <circle cx="3" cy="8"  r="1.4"/>
      <circle cx="7" cy="8"  r="1.4"/>
      <circle cx="3" cy="14" r="1.4"/>
      <circle cx="7" cy="14" r="1.4"/>
    </svg>`;
    document.body.appendChild(_handle);

    const _indicator = document.createElement('div');
    _indicator.className = 'rune-drop-indicator';
    document.body.appendChild(_indicator);

    // ── Show handle on block hover ──────────────────────────────

    editor.listen(editor.content, 'mousemove', (e) => {
      if (_active) return;
      const block = _getDirectChild(e.target);
      if (!block) return;
      _targetBlock = block;
      _positionHandle(block);
    });

    editor.listen(editor.content, 'mouseleave', () => {
      if (_active) return;
      _scheduleHide();
    });

    // Touch has no hover: reveal the handle when a block is tapped so touch
    // users can grab it.
    editor.listen(editor.content, 'pointerdown', (e) => {
      if (e.pointerType !== 'touch' || _active) return;
      const block = _getDirectChild(e.target);
      if (block) { _targetBlock = block; _positionHandle(block); }
    });

    _handle.addEventListener('mouseenter', () => {
      clearTimeout(_hideTimer);
      _handle.style.opacity       = '1';
      _handle.style.pointerEvents = 'auto';
    });

    _handle.addEventListener('mouseleave', () => {
      if (!_active) _scheduleHide();
    });

    // ── Drag via mousedown / mousemove / mouseup ────────────────

    _handle.style.touchAction = 'none';   // let us own touch gestures on the handle
    _handle.addEventListener('pointerdown', (e) => {
      if ((e.pointerType === 'mouse' && e.button !== 0) || !_targetBlock || editor._disabled) return;
      e.preventDefault(); // prevent text selection / scrolling

      _dragging  = _targetBlock;
      _startY    = e.clientY;
      _active    = false;
      _pointerId = e.pointerId;
      // Capture so move/up come to the handle even if the finger/cursor leaves it.
      try { _handle.setPointerCapture(e.pointerId); } catch { /* unsupported */ }

      _handle.addEventListener('pointermove',   _onMove);
      _handle.addEventListener('pointerup',     _onUp);
      _handle.addEventListener('pointercancel', _endDrag);
      document.body.style.userSelect = 'none';
      document.body.style.cursor     = 'grabbing';
    });

    // Throttle move handling to one frame: pointermove can fire >60Hz and each
    // pass does a getBoundingClientRect over every block (O(blocks) layout reads).
    function _onMove(e) {
      _lastMove = { clientY: e.clientY };
      if (_moveRaf) return;
      _moveRaf = requestAnimationFrame(() => { _moveRaf = null; _processMove(_lastMove); });
    }

    function _processMove(e) {
      if (!_dragging) return;

      // Activate after crossing 4px threshold
      if (!_active) {
        if (Math.abs(e.clientY - _startY) < 4) return;
        _active = true;
        // Dim with an animation, not a class or style: the block is in the document,
        // so an attribute would reach onChange, history and peers if anything read it now.
        // Two equal keyframes: with one, it would pulse from the block's own opacity.
        _dimming = _dragging.animate?.([{ opacity: 0.35 }, { opacity: 0.35 }], { duration: 1000, iterations: Infinity });
        _dimming?.finished?.catch(() => {});   // cancelling rejects this promise
        _hideHandle();
      }

      // Find nearest sibling block by cursor Y
      const blocks = [...editor.content.children].filter(b => b !== _dragging);
      if (blocks.length === 0) return;

      let best = null, bestDist = Infinity;
      for (const block of blocks) {
        const rect = block.getBoundingClientRect();
        const mid  = rect.top + rect.height / 2;
        const dist = Math.abs(e.clientY - mid);
        if (dist < bestDist) { bestDist = dist; best = block; }
      }
      if (!best) return;

      const rect = best.getBoundingClientRect();
      _dropPos   = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      _dropBlock = best;
      _showIndicator(best, _dropPos);
    }

    function _onUp() {
      if (_active && _dropBlock && _dropBlock !== _dragging) {
        editor.history.saveNow();
        editor.content.insertBefore(
          _dragging,
          _dropPos === 'before' ? _dropBlock : _dropBlock.nextSibling
        );
        editor._notifyChange();
      }
      _endDrag();
    }

    // Also the whole of a cancelled gesture, which must not move anything.
    function _endDrag() {
      cancelAnimationFrame(_moveRaf);
      _moveRaf = null;
      _handle.removeEventListener('pointermove',   _onMove);
      _handle.removeEventListener('pointerup',     _onUp);
      _handle.removeEventListener('pointercancel', _endDrag);
      try { _handle.releasePointerCapture(_pointerId); } catch { /* already released */ }
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';

      _dimming?.cancel();
      _dimming = null;
      _dragging  = null;
      _dropBlock = null;
      _active    = false;
      _hideIndicator();
    }

    // ── Helpers ─────────────────────────────────────────────────

    function _getDirectChild(target) {
      let node = target;
      while (node && node !== editor.content) {
        if (node.parentElement === editor.content) return node;
        node = node.parentElement;
      }
      return null;
    }

    function _positionHandle(block) {
      const rect = block.getBoundingClientRect();
      _handle.style.top           = `${rect.top + rect.height / 2 - 12}px`;
      _handle.style.left          = `${rect.left - 28}px`;
      _handle.style.opacity       = '1';
      _handle.style.pointerEvents = 'auto';
    }

    function _hideHandle() {
      _handle.style.opacity       = '0';
      _handle.style.pointerEvents = 'none';
    }

    function _scheduleHide() {
      clearTimeout(_hideTimer);
      _hideTimer = setTimeout(_hideHandle, 150);
    }

    function _showIndicator(block, position) {
      const br = block.getBoundingClientRect();
      const cr = editor.content.getBoundingClientRect();
      const y  = position === 'before' ? br.top - 1 : br.bottom + 1;
      _indicator.style.top     = `${y}px`;
      _indicator.style.left    = `${cr.left}px`;
      _indicator.style.width   = `${cr.width}px`;
      _indicator.style.opacity = '1';
    }

    function _hideIndicator() {
      _indicator.style.opacity = '0';
    }

    // Clean up on editor destroy
    editor.events.on('destroy', () => {
      if (_dragging) _endDrag();     // body styles would otherwise stay set
      clearTimeout(_hideTimer);
      _handle.remove();
      _indicator.remove();
    });
  },
};
