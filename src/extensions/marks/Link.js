import { _isDangerousUrl } from '../../utils/html.js';
import { el, getSelectionRect } from '../../utils/dom.js';

/** Normalize loose user input into a usable href (bare domains get https://). */
function _normalizeUrl(raw) {
  let url = raw.trim();
  if (!url) return '';
  // Leave explicit schemes, root-relative, and in-page anchors untouched.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('/') || url.startsWith('#')) return url;
  return `https://${url}`;
}

function _truncate(s, n = 44) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * A single floating popover, reused for both adding/editing a link (an input)
 * and previewing an existing one (Open / Edit / Remove). Created once per
 * editor in Link.init and driven entirely from the DOM — no native prompts.
 */
function createLinkUI(editor) {
  const pop = el('div', { class: 'rune-link-popover', role: 'dialog' });
  pop.style.display = 'none';
  document.body.appendChild(pop);

  let savedRange = null;

  function position(rect) {
    if (!rect) return;
    const pw = pop.offsetWidth || 280;
    const ph = pop.offsetHeight || 44;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + pw > vw - 8) left = vw - pw - 8;
    if (left < 8) left = 8;
    if (top + ph > vh - 8) top = rect.top - ph - 6;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function hide() {
    pop.style.display = 'none';
    pop.innerHTML = '';
  }

  function anchorAtSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const node = sel.getRangeAt(0).commonAncestorContainer;
    const elNode = node?.nodeType === 1 ? node : node?.parentElement;
    return elNode?.closest?.('a') || null;
  }

  function selectAnchor(anchor) {
    const range = document.createRange();
    range.selectNodeContents(anchor);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function restoreSelection() {
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  // ── Edit mode: URL input for adding or changing a link ──────────────────
  function openEditor() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!editor.content.contains(range.commonAncestorContainer)) return;
    savedRange = range.cloneRange();

    const anchor = anchorAtSelection();
    const rect = anchor ? anchor.getBoundingClientRect() : getSelectionRect();

    pop.innerHTML = '';
    const row = el('div', { class: 'rune-link-row' });
    const input = el('input', {
      type: 'text',
      class: 'rune-panel-input rune-link-input',
      placeholder: 'Paste or type a link…',
    });
    input.value = anchor?.getAttribute('href') || '';
    const btn = el('button', { class: 'rune-panel-btn-primary', type: 'button' }, anchor ? 'Update' : 'Add');
    row.append(input, btn);
    pop.appendChild(row);
    pop.style.display = 'block';
    position(rect);
    input.focus();
    input.select();

    const commit = () => {
      const url = _normalizeUrl(input.value);
      if (!url) { hide(); return; }
      if (_isDangerousUrl(url)) { input.classList.add('is-error'); input.focus(); return; }
      restoreSelection();
      editor.cmd('setLink', url);
      hide();
      editor.content.focus();
    };

    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', commit);
    input.addEventListener('input', () => input.classList.remove('is-error'));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); hide(); editor.content.focus(); }
    });
  }

  // ── Info mode: shown when an existing link is clicked ───────────────────
  function openInfo(anchor) {
    const href = anchor.getAttribute('href') || '';
    pop.innerHTML = '';
    const open = el('a', {
      class: 'rune-link-open',
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      title: href,
    }, _truncate(href));
    const edit = el('button', { class: 'rune-link-action', type: 'button' }, 'Edit');
    const remove = el('button', { class: 'rune-link-action', type: 'button' }, 'Remove');
    pop.append(open, el('span', { class: 'rune-link-sep' }), edit, remove);
    pop.style.display = 'flex';
    position(anchor.getBoundingClientRect());

    open.addEventListener('click', () => hide());
    edit.addEventListener('mousedown', (e) => e.preventDefault());
    edit.addEventListener('click', () => { selectAnchor(anchor); openEditor(); });
    remove.addEventListener('mousedown', (e) => e.preventDefault());
    remove.addEventListener('click', () => {
      selectAnchor(anchor);
      editor.cmd('unsetLink');
      hide();
      editor.content.focus();
    });
  }

  return { el: pop, openEditor, openInfo, hide, anchorAtSelection };
}

export const Link = {
  name: 'link',
  type: 'mark',
  tag: 'a',

  init(editor) {
    const ui = createLinkUI(editor);
    editor._linkUI = ui;

    // Open existing links from the editor: modifier/middle click jumps straight
    // to a new tab; a plain click surfaces the Open/Edit/Remove popover.
    editor.content.addEventListener('click', (e) => {
      const a = e.target.closest?.('a');
      if (!a || !editor.content.contains(a)) return;
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        window.open(a.href, '_blank', 'noopener,noreferrer');
      } else {
        ui.openInfo(a);
      }
    });
    editor.content.addEventListener('auxclick', (e) => {
      const a = e.target.closest?.('a');
      if (a && e.button === 1) {
        e.preventDefault();
        window.open(a.href, '_blank', 'noopener,noreferrer');
      }
    });

    // Dismiss when clicking elsewhere, or when the content changes underneath.
    const onOutside = (e) => {
      if (!ui.el.contains(e.target) && !e.target.closest?.('a')) ui.hide();
    };
    document.addEventListener('mousedown', onOutside);
    editor.events.on('change', () => ui.hide());
    editor.events.on('destroy', () => {
      document.removeEventListener('mousedown', onOutside);
      ui.el.remove();
    });
  },

  commands(editor) {
    return {
      setLink(href, text) { editor.cmd('setLink', href, text); },
      unsetLink()         { editor.cmd('unsetLink'); },
      // Opens the inline editor popover at the current selection.
      openLinkEditor()    { editor._linkUI?.openEditor(); },
      // ⌘K behaviour: remove the link if the caret sits in one, otherwise edit.
      toggleLink() {
        const anchor = editor._linkUI?.anchorAtSelection();
        if (anchor) editor.cmd('unsetLink');
        else editor._linkUI?.openEditor();
      },
    };
  },

  keymap: {
    'Meta+k':    (editor) => editor.cmd('openLinkEditor'),
    'Control+k': (editor) => editor.cmd('openLinkEditor'),
  },

  toolbarItem: {
    name: 'link',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    title: 'Link (⌘K)',
    action: 'openLinkEditor',
    isActive: (editor) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      const node = sel.getRangeAt(0).commonAncestorContainer;
      return !!(node?.parentElement?.closest('a'));
    },
  },
};
