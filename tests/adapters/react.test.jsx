import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { StrictMode, act, createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useRune, RuneEditor } from '../../adapters/react/index.js';
import { Paragraph } from '../../src/extensions/blocks/Paragraph.js';

const base = { extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false };

describe('React adapter', () => {
  let host, root;
  beforeAll(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); root = host = null; });

  async function render(el) {
    host = document.createElement('div'); document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(el));
  }
  const contents = () => host.querySelectorAll('.rune-content');

  describe('useRune', () => {
    let api;
    function Probe(props) { api = useRune({ ...base, ...props }); return h('div', { ref: api.ref }); }

    it('mounts an editor with the initial content', async () => {
      await render(h(Probe, { content: '<p>hello</p>' }));
      expect(api.isReady).toBe(true);
      expect(api.getHtml()).toContain('hello');
      expect(api.editor).toBeTruthy();
    });

    it('applies later content changes', async () => {
      await render(h(Probe, { content: '<p>one</p>' }));
      await act(async () => root.render(h(Probe, { content: '<p>two</p>' })));
      expect(api.getHtml()).toContain('two');
    });

    it('does not reset the document when content matches', async () => {
      await render(h(Probe, { content: '<p>one</p>' }));
      const p = host.querySelector('.rune-content p');
      await act(async () => root.render(h(Probe, { content: api.getHtml() })));
      expect(host.querySelector('.rune-content p')).toBe(p);
    });

    it('follows readOnly', async () => {
      await render(h(Probe, { content: '<p>one</p>', readOnly: true }));
      expect(contents()[0].contentEditable).toBe('false');
      await act(async () => root.render(h(Probe, { content: '<p>one</p>', readOnly: false })));
      expect(contents()[0].contentEditable).toBe('true');
    });

    it('calls the latest onChange', async () => {
      const first = vi.fn(), second = vi.fn();
      await render(h(Probe, { content: '<p>one</p>', onChange: first }));
      await act(async () => root.render(h(Probe, { content: '<p>one</p>', onChange: second })));
      act(() => api.setHtml('<p>two</p>'));
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('survives a StrictMode remount with one live editor', async () => {
      await render(h(StrictMode, null, h(Probe, { content: '<p>one</p>' })));
      expect(contents().length).toBe(1);
      expect(api.getHtml()).toContain('one');
    });

    it('destroys the editor on unmount', async () => {
      await render(h(Probe, { content: '<p>one</p>' }));
      const ed = api.editor;
      await act(async () => root.unmount());
      root = null;
      expect(ed._destroyed).toBe(true);
    });

    it('returns safe defaults after unmount', async () => {
      await render(h(Probe, { content: '<p>one</p>' }));
      await act(async () => root.unmount());
      root = null;
      expect(api.getHtml()).toBe('');
      expect(() => api.setHtml('x')).not.toThrow();
    });
  });

  describe('RuneEditor', () => {
    it('renders with a class name and content', async () => {
      await render(h(RuneEditor, { ...base, content: '<p>hi</p>', className: 'mine' }));
      expect(host.querySelector('.rune-editor-container.mine .rune-content p').textContent).toBe('hi');
    });

    it('works as a controlled component without resetting the document', async () => {
      let setExternal;
      const seen = [];
      function App() {
        const [html, setHtml] = useState('<p>one</p>');
        setExternal = setHtml;
        return h(RuneEditor, { ...base, content: html, onChange: (v) => { seen.push(v); setHtml(v); } });
      }
      await render(h(App));
      await act(async () => setExternal('<p>two</p>'));
      expect(host.querySelector('.rune-content').textContent).toBe('two');
      expect(seen.length).toBe(1);
    });
  });
});
