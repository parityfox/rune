import { describe, it, expect, vi } from 'vitest';
import { SlashMenu } from '../../src/ui/SlashMenu.js';
import { EventBus } from '../../src/core/EventBus.js';

function mockEditor() {
  const content = document.createElement('div');
  document.body.appendChild(content);
  return {
    content,
    events: new EventBus(),
    options: {},
    schema: { getSlashItems: () => [] },
    selection: { getBlock: () => null },
  };
}

describe('SlashMenu aria-activedescendant (#60)', () => {
  function mockEditorWithItems() {
    const content = document.createElement('div');
    document.body.appendChild(content);
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
    return {
      content,
      events: new EventBus(),
      options: {},
      schema: { getSlashItems: () => [
        { title: 'Heading', icon: 'H', description: '', action() {} },
        { title: 'List', icon: 'L', description: '', action() {} },
      ] },
      selection: { getBlock: () => null },
    };
  }

  it('points content.aria-activedescendant at the active option and updates on arrow', () => {
    const editor = mockEditorWithItems();
    const menu = new SlashMenu(editor);
    editor.events.emit('slash:open');

    expect(editor.content.getAttribute('aria-controls')).toBe(menu.el.id);
    expect(editor.content.getAttribute('aria-activedescendant')).toBe(`${menu.el.id}-opt-0`);

    editor.content.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(editor.content.getAttribute('aria-activedescendant')).toBe(`${menu.el.id}-opt-1`);

    menu.destroy();
    editor.content.remove();
  });
});

describe('SlashMenu lifecycle (#27/#51)', () => {
  it('detaches its bus subscriptions and capturing keydown listener on destroy', () => {
    const editor = mockEditor();
    const removeSpy = vi.spyOn(editor.content, 'removeEventListener');
    const menu = new SlashMenu(editor);

    expect(editor.events._listeners['slash:open']?.length).toBe(1);
    expect(editor.events._listeners['slash:close']?.length).toBe(1);

    menu.destroy();

    expect(editor.events._listeners['slash:open']?.length ?? 0).toBe(0);
    expect(editor.events._listeners['slash:close']?.length ?? 0).toBe(0);
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);

    editor.content.remove();
  });
});

describe('SlashMenu editing behaviour (#142)', () => {
  function setup(text) {
    const content = document.createElement('div');
    content.innerHTML = `<p>${text}</p>`;
    document.body.appendChild(content);
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
    const action = vi.fn();
    const editor = {
      content, events: new EventBus(), options: {},
      schema: { getSlashItems: () => [{ title: 'Heading', icon: 'H', description: '', action }] },
      selection: { getBlock: () => content.firstChild },
    };
    const menu = new SlashMenu(editor);
    const node = content.firstChild.firstChild;
    const caret = (off) => {
      const r = document.createRange(); r.setStart(node, off); r.collapse(true);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    };
    return { content, editor, menu, node, caret, action };
  }
  const key = (el, k) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    el.dispatchEvent(e);
    return e;
  };

  it('deletes only the slash and query when an item is picked', () => {
    const { editor, menu, node, caret, action, content } = setup('abc');
    caret(3);
    editor.events.emit('slash:open', { editor });   // fired before "/" lands in the DOM
    node.data = 'abc/h';
    caret(5);
    menu._select(menu._filtered[0]);
    expect(content.textContent).toBe('abc');
    expect(action).toHaveBeenCalled();
    menu.destroy();
  });

  it('deletes correctly when the menu opened with the caret on the element', () => {
    const { editor, menu, node, caret, content } = setup('abc');
    const r = document.createRange(); r.selectNodeContents(content.firstChild); r.collapse(false);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    editor.events.emit('slash:open', { editor });
    node.data = 'abc/h';
    caret(5);
    menu._query = 'h';
    menu._select({ action() {} });
    expect(content.textContent).toBe('abc');
    menu.destroy();
  });

  it('keeps a slash earlier in the text', () => {
    const { editor, menu, node, caret, content } = setup('a/b');
    caret(3);
    editor.events.emit('slash:open', { editor });
    node.data = 'a/b/h';
    caret(5);
    menu._query = 'h';
    menu._select({ action() {} });
    expect(content.textContent).toBe('a/b');
    menu.destroy();
  });

  it('leaves Backspace on an empty query to the browser, so one char goes', () => {
    const { editor, menu, node, caret, content } = setup('ab');
    caret(2);
    editor.events.emit('slash:open', { editor });
    node.data = 'ab/';
    caret(3);
    const exec = vi.fn(() => true);
    const orig = document.execCommand;
    document.execCommand = exec;
    const e = key(content, 'Backspace');
    document.execCommand = orig;
    expect(exec).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
    menu.destroy();
  });

  it('closes and lets Enter through when nothing matches', () => {
    const { editor, menu, content } = setup('x');
    editor.events.emit('slash:open', { editor });
    for (const c of 'zzz') key(content, c);
    expect(menu._filtered.length).toBe(0);
    const e = key(content, 'Enter');
    expect(e.defaultPrevented).toBe(false);
    expect(menu._open).toBe(false);
    menu.destroy();
  });

  it('closes on space when nothing matches', () => {
    const { editor, menu, content } = setup('x');
    editor.events.emit('slash:open', { editor });
    for (const c of 'zzz ') key(content, c);
    expect(menu._open).toBe(false);
    menu.destroy();
  });

  it('keeps Enter selecting when something matches', () => {
    const { editor, menu, content, action } = setup('x');
    editor.events.emit('slash:open', { editor });
    const e = key(content, 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(action).toHaveBeenCalled();
    menu.destroy();
  });
});
