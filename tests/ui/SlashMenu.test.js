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
