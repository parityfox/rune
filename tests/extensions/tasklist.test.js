import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '../../src/core/Editor.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';
import { TaskList } from '../../src/extensions/blocks/TaskList.js';

describe('TaskList checkbox keyboard access (#62)', () => {
  let target, editor;
  beforeEach(() => { target = document.createElement('div'); document.body.appendChild(target); });
  afterEach(() => { editor?.destroy(); target.remove(); });

  it('exposes the checkbox as a focusable role=checkbox and toggles via keyboard', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, TaskList],
      toolbar: false, bubbleMenu: false, slashMenu: false,
    });
    editor.cmd('insertTaskList');
    const cb = editor.content.querySelector('.rune-task-checkbox');

    expect(cb.getAttribute('role')).toBe('checkbox');
    expect(cb.getAttribute('tabindex')).toBe('0');
    expect(cb.getAttribute('aria-checked')).toBe('false');

    cb.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(cb.getAttribute('aria-checked')).toBe('true');
    expect(cb.closest('.rune-task-item').dataset.checked).toBe('true');

    cb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(cb.getAttribute('aria-checked')).toBe('false');
  });

  it('keeps the a11y attributes through a getHtml -> setHtml round trip', () => {
    editor = new Editor(target, {
      extensions: [Paragraph, TaskList],
      toolbar: false, bubbleMenu: false, slashMenu: false,
    });
    editor.cmd('insertTaskList');
    editor.setHtml(editor.getHtml());
    const cb = editor.content.querySelector('.rune-task-checkbox');
    expect(cb.getAttribute('role')).toBe('checkbox');
    expect(cb.getAttribute('tabindex')).toBe('0');
  });
});
