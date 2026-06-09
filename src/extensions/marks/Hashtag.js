/**
 * Hashtag — `#tag` autocomplete. By default it offers to create the tag as
 * typed; supply suggestions via `new Editor(el, { fetchHashtags })`:
 *   fetchHashtags: (query) => Promise<Array<{ label, value }>>
 */
function row(text) {
  const r = document.createElement('div');
  r.className = 'rune-suggestion-row';
  r.textContent = text;
  return r;
}

export const Hashtag = {
  name: 'hashtag',
  type: 'mark',
  tag: 'a',
  match: (el) => el.classList?.contains('rune-hashtag'),

  suggestion: {
    char: '#',
    items: async ({ query, editor }) => {
      const fn = editor.options.fetchHashtags;
      if (typeof fn === 'function') { try { return (await fn(query)) || []; } catch { return []; } }
      return query ? [{ label: query, value: query }] : [];   // default: create-as-typed
    },
    render: (item) => row('#' + (item.label ?? item.value)),
    command: ({ editor, item, range }) => {
      const value = item.value ?? item.label;
      range.deleteContents();
      const a = document.createElement('a');
      a.className = 'rune-hashtag';
      a.setAttribute('data-id', String(value));
      a.textContent = '#' + value;
      range.insertNode(a);
      const sp = document.createTextNode(' ');
      a.after(sp);
      const r = document.createRange(); r.setStartAfter(sp); r.collapse(true);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      editor.options.onHashtag?.(value, editor);
      editor._notifyChange();
    },
  },
};
