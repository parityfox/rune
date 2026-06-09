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

function mockEditorMulti(items) {
  return {
    options: { toolbar: { items: items.map(i => i.name) } },
    schema: { getToolbarItems: () => items },
    events: new EventBus(),
    cmd: vi.fn(),
  };
}

describe('Toolbar aria-pressed (#56)', () => {
  it('reflects toggle state via aria-pressed on plain toggle buttons', async () => {
    let active = false;
    const item = {
      name: 'bold', title: 'Bold', icon: 'B', action: 'toggleBold',
      type: 'mark', isActive: () => active,
    };
    const editor = mockEditor(item);
    const tb = new Toolbar(editor);
    const btn = tb.el.querySelector('.rune-toolbar-btn');
    const frame = () => new Promise((r) => requestAnimationFrame(r));   // flush coalesced update

    expect(btn.getAttribute('aria-pressed')).toBe('false');

    active = true;
    editor.events.emit('selectionchange');
    await frame();
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    active = false;
    editor.events.emit('selectionchange');
    await frame();
    expect(btn.getAttribute('aria-pressed')).toBe('false');

    tb.destroy();
  });

  it('activates the command on click, not just mousedown (#54 keyboard)', () => {
    const item = { name: 'bold', title: 'Bold', icon: 'B', action: 'toggleBold', type: 'mark' };
    const editor = mockEditor(item);
    const tb = new Toolbar(editor);
    const btn = tb.el.querySelector('.rune-toolbar-btn');

    // A keyboard activation dispatches 'click' with no preceding 'mousedown'.
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editor.cmd).toHaveBeenCalledWith('toggleBold');
    tb.destroy();
  });

  it('uses roving tabindex and moves focus with arrow keys (#55)', () => {
    const items = [
      { name: 'bold', title: 'Bold', icon: 'B', action: 'toggleBold', type: 'mark' },
      { name: 'italic', title: 'Italic', icon: 'I', action: 'toggleItalic', type: 'mark' },
    ];
    const editor = mockEditorMulti(items);
    const tb = new Toolbar(editor);
    document.body.appendChild(tb.el);   // focus() only updates activeElement when attached
    const btns = [...tb.el.querySelectorAll('button')];

    expect(btns[0].getAttribute('tabindex')).toBe('0');
    expect(btns[1].getAttribute('tabindex')).toBe('-1');

    btns[0].focus();
    tb.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(btns[1].getAttribute('tabindex')).toBe('0');
    expect(btns[0].getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(btns[1]);

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
