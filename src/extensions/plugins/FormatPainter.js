/**
 * FormatPainter — copy formatting from one text range and paint it onto another.
 *
 * Click the toolbar button to capture format at the caret / selection,
 * then click/drag to select the target text. The format is applied and
 * the painter deactivates automatically. Click the button again to cancel.
 */

// Per-editor state stored outside closures so isActive() can read it
const _state = new WeakMap();

export const FormatPainter = {
  name: 'formatPainter',
  type: 'plugin',

  init(editor) {
    const state = { active: false, format: null, _handler: null };
    _state.set(editor, state);
    // If the editor is destroyed while the painter is armed, the onMouseUp
    // listener (and the rune-painter-active class) would stay bound to the
    // detached content node. Tear it down with the editor.
    editor.events.on('destroy', () => {
      _deactivate(editor, state);
      _state.delete(editor);
    });
  },

  commands(editor) {
    return {
      activateFormatPainter() {
        const state = _state.get(editor);
        if (!state) return;

        // Toggle off if already armed
        if (state.active) { _deactivate(editor, state); return; }

        const format = _captureFormat(editor);
        if (!format) return;

        state.active = true;
        state.format = format;
        editor.content.classList.add('rune-painter-active');
        editor.events.emit('selectionchange'); // refresh toolbar active state

        function onMouseUp() {
          editor.content.removeEventListener('mouseup', onMouseUp);
          state._handler = null;
          // Let the browser finalise the selection, then paint
          requestAnimationFrame(() => {
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) _applyFormat(editor, state.format);
            _deactivate(editor, state);
          });
        }

        state._handler = onMouseUp;
        editor.content.addEventListener('mouseup', onMouseUp);
      },
    };
  },

  toolbarItem: {
    name: 'formatPainter',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
      <rect width="16" height="6" x="2" y="2" rx="2"/>
      <path d="M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7"/>
      <rect width="4" height="6" x="8" y="16" rx="1"/>
    </svg>`,
    title: 'Copy Format',
    action: 'activateFormatPainter',
    isActive: (editor) => _state.get(editor)?.active ?? false,
  },
};

// ── Helpers ───────────────────────────────────────────────────

function _deactivate(editor, state) {
  if (state._handler) {
    editor.content.removeEventListener('mouseup', state._handler);
    state._handler = null;
  }
  state.active = false;
  state.format = null;
  editor.content.classList.remove('rune-painter-active');
  editor.events.emit('selectionchange');
}

/** Read formatting at the current caret / selection anchor. */
function _captureFormat(editor) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;

  const anchor = sel.anchorNode;
  const format = {
    bold:          document.queryCommandState('bold'),
    italic:        document.queryCommandState('italic'),
    underline:     document.queryCommandState('underline'),
    strikeThrough: document.queryCommandState('strikeThrough'),
    fontSize:      null,
    fontFamily:    null,
    color:         null,
    background:    null,
  };

  // Walk up from anchor node collecting inline styles
  let node = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
  while (node && node !== editor.content) {
    const s = node.style;
    if (s) {
      if (!format.fontSize   && s.fontSize)                        format.fontSize   = s.fontSize;
      if (!format.fontFamily && s.fontFamily)                      format.fontFamily = s.fontFamily;
      if (!format.color      && s.color)                           format.color      = s.color;
      if (!format.background && (s.background || s.backgroundColor))
        format.background = s.background || s.backgroundColor;
    }
    node = node.parentElement;
  }

  return format;
}

/** Apply captured format to the current selection. */
function _applyFormat(editor, format) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;

  editor.history.saveNow();

  // 1. Toggle boolean marks (execCommand works while selection is live)
  if (format.bold          !== document.queryCommandState('bold'))          document.execCommand('bold');
  if (format.italic        !== document.queryCommandState('italic'))        document.execCommand('italic');
  if (format.underline     !== document.queryCommandState('underline'))     document.execCommand('underline');
  if (format.strikeThrough !== document.queryCommandState('strikeThrough')) document.execCommand('strikeThrough');

  // 2. Apply inline styles via extract → modify → re-insert
  const sel2 = window.getSelection();
  if (!sel2 || !sel2.rangeCount) { editor._notifyChange(); return; }
  const range = sel2.getRangeAt(0);
  const frag  = range.extractContents();

  // Strip existing font/color styles so the new ones are unambiguous
  frag.querySelectorAll('span').forEach(s => {
    s.style.fontSize = '';
    s.style.fontFamily = '';
    s.style.color = '';
    s.style.background = '';
    s.style.backgroundColor = '';
    if (!s.getAttribute('style')?.trim()) s.replaceWith(...s.childNodes);
  });

  // Wrap with the captured styles if any were set
  const hasStyle = format.fontSize || format.fontFamily || format.color || format.background;
  if (hasStyle) {
    const span = document.createElement('span');
    if (format.fontSize)   span.style.fontSize   = format.fontSize;
    if (format.fontFamily) span.style.fontFamily = format.fontFamily;
    if (format.color)      span.style.color      = format.color;
    if (format.background) span.style.background = format.background;
    span.appendChild(frag);
    range.insertNode(span);
  } else {
    range.insertNode(frag);
  }

  editor._notifyChange();
}
