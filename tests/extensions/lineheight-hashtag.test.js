import { describe, it, expect, vi, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { LineHeight } from '../../src/extensions/formatting/LineHeight.js';
import { Hashtag } from '../../src/extensions/marks/Hashtag.js';

let target, editor;
afterEach(() => { editor?.destroy(); target?.remove(); editor = target = null; });
function make(content, opts = {}, extensions = [Paragraph, LineHeight]) {
  target = document.createElement('div'); document.body.appendChild(target);
  editor = new Editor(target, { extensions, toolbar: false, bubbleMenu: false, slashMenu: false, content, ...opts });
}
function caretInto(el) {
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}

describe('LineHeight', () => {
  it('sets the line height on the caret block only', () => {
    make('<p>one</p><p>two</p>');
    const [a, b] = editor.content.querySelectorAll('p');
    caretInto(b);
    editor.cmd('setLineHeight', '1.75');
    expect(b.style.lineHeight).toBe('1.75');
    expect(a.style.lineHeight).toBe('');
  });

  it('does nothing with no caret in the editor', () => {
    make('<p>one</p>');
    window.getSelection().removeAllRanges();
    expect(() => editor.cmd('setLineHeight', '2')).not.toThrow();
    expect(editor.content.querySelector('p').style.lineHeight).toBe('');
  });

  it('is undoable', () => {
    make('<p>one</p>');
    caretInto(editor.content.querySelector('p'));
    editor.cmd('setLineHeight', '2');
    editor.history.undo();
    expect(editor.content.querySelector('p').style.lineHeight).toBe('');
  });

  it('survives setHtml round trip', () => {
    make('<p style="line-height: 2;">one</p>');
    editor.setHtml(editor.getHtml());
    expect(editor.content.querySelector('p').style.lineHeight).toBe('2');
  });

  describe('panel', () => {
    const panel = (close = () => {}) => LineHeight.toolbarItem.renderPanel(editor, close);

    it('marks the current value', () => {
      make('<p style="line-height: 1.25;">one</p>');
      caretInto(editor.content.querySelector('p'));
      const active = panel().querySelectorAll('.is-active');
      expect(active.length).toBe(1);
      expect(active[0].textContent).toContain('Snug');
    });

    it('applies a value and closes when chosen with the keyboard', () => {
      make('<p>one</p>');
      caretInto(editor.content.querySelector('p'));
      const close = vi.fn();
      const loose = [...panel(close).querySelectorAll('button')].find((b) => b.textContent.includes('Loose'));
      loose.click();                                  // Enter and Space dispatch click
      expect(editor.content.querySelector('p').style.lineHeight).toBe('2');
      expect(close).toHaveBeenCalled();
    });

    it('keeps the selection when pressed with the mouse', () => {
      make('<p>one</p>');
      caretInto(editor.content.querySelector('p'));
      const btn = panel().querySelector('button');
      const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      btn.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
    });
  });
});

describe('Hashtag', () => {
  const { items, render, command } = Hashtag.suggestion;

  it('offers to create the typed tag by default', async () => {
    make('<p></p>', {}, [Paragraph, Hashtag]);
    expect(await items({ query: 'news', editor })).toEqual([{ label: 'news', value: 'news' }]);
    expect(await items({ query: '', editor })).toEqual([]);
  });

  it('uses fetchHashtags when supplied', async () => {
    make('<p></p>', { fetchHashtags: async (q) => [{ label: q + '1', value: 'x' }] }, [Paragraph, Hashtag]);
    expect(await items({ query: 'a', editor })).toEqual([{ label: 'a1', value: 'x' }]);
  });

  it('treats a failing or empty fetchHashtags as no results', async () => {
    make('<p></p>', { fetchHashtags: async () => { throw new Error('offline'); } }, [Paragraph, Hashtag]);
    expect(await items({ query: 'a', editor })).toEqual([]);
    editor.options.fetchHashtags = async () => null;
    expect(await items({ query: 'a', editor })).toEqual([]);
  });

  it('renders a row as text, not markup', () => {
    const row = render({ label: '<img src=x>' });
    expect(row.querySelector('img')).toBeNull();
    expect(row.textContent).toBe('#<img src=x>');
  });

  function insert(value, opts) {
    make('<p>see #ne</p>', opts, [Paragraph, Hashtag]);
    const t = editor.content.querySelector('p').firstChild;
    const range = document.createRange(); range.setStart(t, 4); range.setEnd(t, 7);
    command({ editor, item: { value }, range });
  }

  it('replaces the query with a tag and a trailing space', () => {
    insert('news');
    const a = editor.content.querySelector('a.rune-hashtag');
    expect(a.textContent).toBe('#news');
    expect(editor.content.querySelector('p').textContent).toBe('see #news ');
  });

  it('inserts a hostile value as text', () => {
    insert('<img src=x onerror=1>');
    expect(editor.content.querySelector('img')).toBeNull();
  });

  it('reports the tag and the change', () => {
    const onHashtag = vi.fn(), onChange = vi.fn();
    insert('news', { onHashtag, onChange });
    expect(onHashtag.mock.calls[0][0]).toBe('news');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('survives a getHtml and setHtml round trip', () => {
    insert('news');
    editor.setHtml(editor.getHtml());
    expect(editor.content.querySelector('a.rune-hashtag')?.textContent).toBe('#news');
  });

  it('is recognised by the schema', () => {
    expect(Hashtag.match(Object.assign(document.createElement('a'), { className: 'rune-hashtag' }))).toBe(true);
    expect(Hashtag.match(document.createElement('a'))).toBe(false);
  });
});
