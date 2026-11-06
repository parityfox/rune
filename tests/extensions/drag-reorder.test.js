import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { DragReorder } from '../../src/extensions/plugins/DragReorder.js';

describe('DragReorder', () => {
  let target, editor, handle;
  beforeEach(() => {
    target = document.createElement('div'); document.body.appendChild(target);
    editor = new Editor(target, {
      extensions: [Paragraph, DragReorder], toolbar: false, bubbleMenu: false, slashMenu: false,
      content: '<p>one</p><p>two</p><p>three</p>',
    });
    [...editor.content.children].forEach((b, i) => {
      b.getBoundingClientRect = () => ({ top: i * 100, bottom: i * 100 + 50, height: 50, left: 0, width: 100 });
    });
    handle = [...document.querySelectorAll('.rune-drag-handle')].pop();
  });
  afterEach(() => { if (!editor._destroyed) editor.destroy(); target.remove(); });

  const order = () => [...editor.content.children].map((b) => b.textContent).join(',');
  const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const pointer = (el, type, props = {}) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { pointerType: 'mouse', button: 0, pointerId: 1, clientY: 0 }, props);
    el.dispatchEvent(e);
    return e;
  };
  const hover = (i) => editor.content.children[i].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  async function drag(fromIndex, toY, end = 'pointerup') {
    hover(fromIndex);
    pointer(handle, 'pointerdown', { clientY: fromIndex * 100 + 25 });
    pointer(handle, 'pointermove', { clientY: toY });
    await frame();
    pointer(handle, end, { clientY: toY });
  }

  it('moves a block below another', async () => {
    await drag(0, 180);
    expect(order()).toBe('two,one,three');
  });

  it('moves a block above another', async () => {
    await drag(2, 10);
    expect(order()).toBe('three,one,two');
  });

  it('moving is one undo step', async () => {
    await drag(0, 280);
    expect(order()).toBe('two,three,one');
    editor.history.undo();
    expect(order()).toBe('one,two,three');
  });

  it('notifies a change after moving', async () => {
    let n = 0;
    editor.events.on('change', () => { n++; });
    await drag(0, 180);
    expect(n).toBe(1);
  });

  it('ignores movement under the 4px threshold', async () => {
    await drag(0, 27);
    expect(order()).toBe('one,two,three');
  });

  it('ignores a non-primary mouse button', async () => {
    hover(0);
    pointer(handle, 'pointerdown', { button: 2, clientY: 25 });
    pointer(handle, 'pointermove', { clientY: 180 });
    await frame();
    pointer(handle, 'pointerup', { clientY: 180 });
    expect(order()).toBe('one,two,three');
  });

  it('a cancelled gesture moves nothing', async () => {
    await drag(0, 180, 'pointercancel');
    expect(order()).toBe('one,two,three');
    expect(document.body.style.userSelect).toBe('');
  });

  it('does nothing on a disabled editor', async () => {
    editor.disable();
    await drag(0, 180);
    expect(order()).toBe('one,two,three');
    expect(document.body.style.cursor).toBe('');
  });

  it('marks the dragged block only during the drag', async () => {
    hover(0);
    const block = editor.content.children[0];
    pointer(handle, 'pointerdown', { clientY: 25 });
    pointer(handle, 'pointermove', { clientY: 180 });
    await frame();
    expect(block.classList.contains('rune-dragging')).toBe(true);
    pointer(handle, 'pointerup', { clientY: 180 });
    expect(block.classList.contains('rune-dragging')).toBe(false);
  });

  it('restores page styles if destroyed mid-drag', () => {
    hover(0);
    pointer(handle, 'pointerdown', { clientY: 25 });
    expect(document.body.style.userSelect).toBe('none');
    editor.destroy();
    expect(document.body.style.userSelect).toBe('');
    expect(document.body.style.cursor).toBe('');
  });

  it('destroy removes the floating elements', () => {
    editor.destroy();
    expect(document.body.contains(handle)).toBe(false);
  });
});
