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
    _state.set(editor, { active: false, format: null, _handler: null });
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
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/>
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.5.5 1 2 2 4.5 1.5 2.5-.5 3.5-2.5 3.5-3.5-.02-1.67-1.35-3.02-3-3.02z"/>
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
