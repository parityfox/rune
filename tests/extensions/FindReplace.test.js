import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { FindReplace } from '../../src/extensions/plugins/FindReplace.js';

describe('FindReplace replace navigation (#31/#32)', () => {
  let target, editor;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  });
  afterEach(() => {
    editor?.destroy();
    target.remove();
    document.body.querySelectorAll('.rune-fr-panel').forEach(p => p.remove());
  });

  function openPanel() {
    editor.content.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true }));
    return document.body.querySelector('.rune-fr-panel');
  }

  it('Replace advances to the next match instead of resetting to the first', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, FindReplace],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>foo foo foo</p>',
    });
    const panel = openPanel();
    const find = panel.querySelector('.rune-fr-find');
    const count = panel.querySelector('.rune-fr-count');
    const repl = panel.querySelector('.rune-fr-replace');
    const replBtn = [...panel.querySelectorAll('.rune-fr-btn--text')].find(b => b.textContent === 'Replace');

    find.value = 'foo';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    expect(count.textContent).toBe('1/3');

    // Move to the MIDDLE match, then replace it.
    find.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(count.textContent).toBe('2/3');

    repl.value = 'bar';
    replBtn.click();

    // Middle replaced; active advances to the LAST original match (2/2), not reset to 1/2.
    expect(count.textContent).toBe('2/2');
    expect(editor.getHtml().replace(/<\/?p>/g, '')).toBe('foo bar foo');
  });

  it('keeps getHtml pristine while searching — highlights use the overlay (#82)', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, FindReplace],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>foo foo</p>',
    });
    const panel = openPanel();
    const find = panel.querySelector('.rune-fr-find');
    find.value = 'foo';
    find.dispatchEvent(new Event('input', { bubbles: true }));

    expect(panel.querySelector('.rune-fr-count').textContent).toBe('1/2');
    expect(editor.getHtml()).toBe('<p>foo foo</p>');             // no <mark> injected
    expect(editor.content.querySelector('mark')).toBeFalsy();
  });

  it('Replace All does not re-match its own replacement text (#32)', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, FindReplace],
      toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>a a a</p>',
    });
    const panel = openPanel();
    const find = panel.querySelector('.rune-fr-find');
    const count = panel.querySelector('.rune-fr-count');
    const repl = panel.querySelector('.rune-fr-replace');
    const allBtn = [...panel.querySelectorAll('.rune-fr-btn--text')].find(b => b.textContent === 'All');

    find.value = 'a';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    expect(count.textContent).toBe('1/3');

    repl.value = 'aa';                 // replacement contains the query
    allBtn.click();

    expect(count.textContent).toBe('0/0');                  // not re-matched into 'aa'
    expect(editor.getHtml().replace(/<\/?p>/g, '')).toBe('aa aa aa');
  });
});

describe('FindReplace from the keyboard (#185)', () => {
  let target, editor, panel, count;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
    editor = new Editor(target, {
      extensions: [Paragraph, FindReplace], toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>foo foo foo</p>',
    });
    editor.content.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true }));
    panel = document.body.querySelector('.rune-fr-panel');
    count = panel.querySelector('.rune-fr-count');
    const find = panel.querySelector('.rune-fr-find');
    find.value = 'foo';
    find.dispatchEvent(new Event('input', { bubbles: true }));
  });
  afterEach(() => {
    if (!editor._destroyed) editor.destroy();
    target.remove();
    document.body.querySelectorAll('.rune-fr-panel').forEach((p) => p.remove());
  });

  const btn = (title) => [...panel.querySelectorAll('button')].find((b) => (b.title || b.textContent).startsWith(title));
  const press = (b) => {
    const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    b.dispatchEvent(e);
    return e;
  };
  const esc = (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

  it('Next acts on click', () => {
    btn('Next').click();
    expect(count.textContent).toBe('2/3');
  });

  it('Previous acts on click', () => {
    btn('Previous').click();
    expect(count.textContent).toBe('3/3');
  });

  it('Replace acts on click', () => {
    panel.querySelector('.rune-fr-replace').value = 'x';
    btn('Replace').click();
    expect(editor.content.textContent).toBe('x foo foo');
  });

  it('All acts on click', () => {
    panel.querySelector('.rune-fr-replace').value = 'x';
    btn('All').click();
    expect(editor.content.textContent).toBe('x x x');
  });

  it('Close acts on click', () => {
    btn('Close').click();
    expect(editor.decorations._items.size).toBe(0);
  });

  it('a mouse press only keeps the selection', () => {
    const before = count.textContent;
    for (const name of ['Next', 'Previous', 'Replace', 'All']) {
      expect(press(btn(name)).defaultPrevented).toBe(true);
    }
    expect(count.textContent).toBe(before);
    expect(editor.content.textContent).toBe('foo foo foo');
  });

  for (const name of ['Next', 'Close']) {
    it(`Escape closes from the ${name} button`, () => {
      esc(btn(name));
      expect(editor.decorations._items.size).toBe(0);
    });
  }

  for (const [label, get] of [['find field', () => panel.querySelector('.rune-fr-find')], ['replace field', () => panel.querySelector('.rune-fr-replace')], ['All button', () => btn('All')]]) {
    it(`Escape from the ${label} returns focus to the editor`, () => {
      const el = get();
      el.focus();
      esc(el);
      expect(document.activeElement).toBe(editor.content);
    });
  }

  it('the Close button returns focus to the editor', () => {
    btn('Close').focus();
    btn('Close').click();
    expect(document.activeElement).toBe(editor.content);
  });

  it('Escape works once, so reopening still works', () => {
    esc(panel.querySelector('.rune-fr-find'));
    editor.content.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true }));
    const again = [...document.body.querySelectorAll('.rune-fr-panel')].pop();
    expect(again).toBeTruthy();
    expect(document.activeElement).toBe(again.querySelector('.rune-fr-find'));
  });

  describe('on a disabled editor', () => {
    beforeEach(() => {
      editor.disable();
      panel.querySelector('.rune-fr-replace').value = 'x';
    });

    it('Replace changes nothing', () => {
      btn('Replace').click();
      expect(editor.content.textContent).toBe('foo foo foo');
    });

    it('All changes nothing', () => {
      btn('All').click();
      expect(editor.content.textContent).toBe('foo foo foo');
    });

    it('finding still works', () => {
      btn('Next').click();
      expect(count.textContent).toBe('2/3');
    });
  });

  it('closing before the first frame does not throw', async () => {
    const errors = [];
    const onError = (e) => errors.push(e);
    process.on('uncaughtException', onError);
    window.addEventListener('error', onError);
    esc(panel.querySelector('.rune-fr-find'));
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    process.off('uncaughtException', onError);
    window.removeEventListener('error', onError);
    expect(errors).toEqual([]);
  });

  it('destroying the editor removes the panel', async () => {
    editor.destroy();
    await new Promise((r) => setTimeout(r, 200));
    expect(document.body.contains(panel)).toBe(false);
  });
});
