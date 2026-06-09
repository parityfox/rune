import { describe, it, expect, vi } from 'vitest';
import { Toolbar } from '../../src/ui/Toolbar.js';
import { EventBus } from '../../src/core/EventBus.js';

function mockEditor(item) {
  return {
    options: { toolbar: { items: [item.name] } },
    schema: { getToolbarItems: () => [item] },
    events: new EventBus(),
    cmd: vi.fn(),
  };
}

describe('Toolbar aria-pressed (#56)', () => {
  it('reflects toggle state via aria-pressed on plain toggle buttons', () => {
    let active = false;
    const item = {
      name: 'bold', title: 'Bold', icon: 'B', action: 'toggleBold',
      type: 'mark', isActive: () => active,
    };
    const editor = mockEditor(item);
    const tb = new Toolbar(editor);
    const btn = tb.el.querySelector('.rune-toolbar-btn');

    expect(btn.getAttribute('aria-pressed')).toBe('false');

    active = true;
    editor.events.emit('selectionchange');
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    active = false;
    editor.events.emit('selectionchange');
    expect(btn.getAttribute('aria-pressed')).toBe('false');

    tb.destroy();
  });

  it('does not put aria-pressed on dropdown buttons', () => {
    const item = {
      name: 'heading', title: 'Heading', icon: 'H',
      dropdown: [{ label: 'H1', action: 'setBlock', args: ['heading'] }],
    };
    const editor = mockEditor(item);
    const tb = new Toolbar(editor);
    const btn = tb.el.querySelector('.rune-toolbar-btn');
    expect(btn.hasAttribute('aria-pressed')).toBe(false);
    expect(btn.getAttribute('aria-haspopup')).toBe('true');
    tb.destroy();
  });
});
