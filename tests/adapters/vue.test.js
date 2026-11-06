import { describe, it, expect } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import { RuneEditor } from '../../adapters/vue/index.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';

function mount(content) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const exposed = ref(null);
  const app = createApp({
    render: () => h(RuneEditor, {
      ref: exposed, extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false, content: content.value,
    }),
  });
  app.mount(host);
  return { exposed, unmount: () => { app.unmount(); host.remove(); } };
}

describe('Vue <RuneEditor> content prop (#152)', () => {
  it('renders the initial content', () => {
    const { exposed, unmount } = mount(ref('<p>one</p>'));
    expect(exposed.value.getHtml()).toContain('one');
    unmount();
  });

  it('applies later prop updates', async () => {
    const content = ref('<p>one</p>');
    const { exposed, unmount } = mount(content);
    content.value = '<p>two</p>';
    await nextTick();
    await nextTick();
    expect(exposed.value.getHtml()).toContain('two');
    unmount();
  });

  it('does not reset the document when the prop already matches', async () => {
    const content = ref('<p>one</p>');
    const { exposed, unmount } = mount(content);
    const p = exposed.value.editor.content.querySelector('p');
    content.value = exposed.value.getHtml();
    await nextTick();
    expect(exposed.value.editor.content.querySelector('p')).toBe(p);
    unmount();
  });
});
