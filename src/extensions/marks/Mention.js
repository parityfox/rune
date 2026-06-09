/**
 * Mention — `@name` autocomplete inserting a non-editable mention chip.
 * Provide the data source via `new Editor(el, { fetchMentions })`:
 *   fetchMentions: (query) => Promise<Array<{ id, label }>>
 */
function row(text) {
  const r = document.createElement('div');
  r.className = 'rune-suggestion-row';
  r.textContent = text;
  return r;
}

export const Mention = {
  name: 'mention',
  type: 'mark',
  tag: 'span',
  match: (el) => el.classList?.contains('rune-mention'),

  suggestion: {
    char: '@',
    items: async ({ query, editor }) => {
      const fn = editor.options.fetchMentions;
      if (typeof fn !== 'function') return [];
      try { return (await fn(query)) || []; } catch { return []; }
    },
    render: (item) => row(item.label ?? item.name ?? String(item.id ?? '')),
    command: ({ editor, item, range }) => {
      range.deleteContents();
      const span = document.createElement('span');
      span.className = 'rune-mention';
      span.setAttribute('contenteditable', 'false');
      if (item.id != null) span.setAttribute('data-id', String(item.id));
      span.textContent = '@' + (item.label ?? item.name ?? item.id);
      range.insertNode(span);
      const sp = document.createTextNode(' ');
      span.after(sp);
      const r = document.createRange(); r.setStartAfter(sp); r.collapse(true);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      editor.options.onMention?.(item, editor);
      editor._notifyChange();
    },
  },
};
