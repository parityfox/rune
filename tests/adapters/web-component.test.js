import { describe, it, expect, afterEach } from 'vitest';
import '../../adapters/web-component/rune-editor.js';

describe('<rune-editor> web component', () => {
  let el;
  afterEach(() => { el?.remove(); el = null; });

  function mount(attrs = {}, lightDom = '') {
    el = document.createElement('rune-editor');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (lightDom) el.innerHTML = lightDom;
    document.body.appendChild(el);
    return el;
  }

  it('mounts an editor from the content attribute', () => {
    mount({ content: '<p>hello</p>' });
    expect(el.getHtml()).toContain('hello');
  });

  // #116: moving the element (remove + re-insert) fires disconnected +
  // connected. That must not leak a mount div per move, and edits made
  // before the move must survive it.
  it('does not leak mount divs and keeps edits when moved in the DOM (#116)', () => {
    mount({ content: '<p>hello</p>' });
    el.setHtml('<p>edited</p>');

    const other = document.createElement('div');
    document.body.appendChild(other);
    other.appendChild(el);                    // disconnect + reconnect

    expect(el.querySelectorAll(':scope > div').length).toBe(1);
    expect(el.getHtml()).toContain('edited');
    other.remove();
  });

  it('uses light-DOM content even when it starts with an empty div (#116)', () => {
    mount({}, '<div></div><p>from light dom</p>');
    expect(el.getHtml()).toContain('from light dom');
    expect(el.getHtml()).not.toContain('rune');   // mount/editor markup must not leak into content
  });
});
