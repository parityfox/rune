/**
 * <rune-editor> — Web Component adapter for Rune Editor.
 *
 * Drop-in usage (no framework required):
 *
 *   <script type="module" src="adapters/web-component/rune-editor.js"></script>
 *   <link rel="stylesheet" href="styles/rune.css">
 *
 *   <rune-editor
 *     content="<p>Hello world</p>"
 *     placeholder="Start writing…"
 *     readonly
 *   ></rune-editor>
 *
 * Attributes (all optional):
 *   content       — initial HTML content
 *   placeholder   — editor placeholder text
 *   readonly      — disables editing when present
 *
 * Events:
 *   change        — fires on every content change; event.detail = html string
 *
 * Properties / methods (available after connectedCallback):
 *   el.editor       — the underlying Rune Editor instance
 *   el.getHtml()    — returns current HTML
 *   el.setHtml(html)
 *   el.getMarkdown()
 *   el.print()
 *   el.cmd(name, ...args)
 */

import { createFromConfig } from '../../src/createFromConfig.js';
import defaultConfig        from '../../rune.config.js';

class RuneEditorElement extends HTMLElement {
  // `attribution` is intentionally not observed: the "Made with Rune" credit is
  // applied once at mount (connectedCallback reads the attribute), so observing
  // it would imply a runtime toggle that doesn't exist.
  static get observedAttributes() {
    return ['content', 'placeholder', 'readonly'];
  }

  connectedCallback() {
    if (this._editor) return; // already mounted (e.g. moved in DOM)

    // Build a config copy so we don't mutate the shared default
    // Use nested spread to preserve function values (e.g. uploadImage)
    const config = Object.fromEntries(
      Object.entries(defaultConfig).map(([k, v]) =>
        [k, v && typeof v === 'object' ? { ...v } : v]
      )
    );

    if (this.hasAttribute('placeholder')) {
      config.editor.placeholder = this.getAttribute('placeholder');
    }
    if (this.hasAttribute('readonly')) {
      config.editor.readOnly = true;
    }
    if (this.getAttribute('attribution') === 'false') {
      config.editor.attribution = false;     // opt out of the "Made with Rune" credit
    }

    // Capture author light DOM BEFORE appending the mount div, so an author
    // <div></div> can't be confused with the mount when extracting content.
    const lightDom = this.innerHTML.trim();

    // Mount point — inner div so the custom element itself stays clean
    const mount = document.createElement('div');
    this._mount = mount;
    this.appendChild(mount);

    const initialContent =
      // A DOM move fires disconnected + connected; restore the edits captured
      // on disconnect rather than resetting to the (stale) content attribute.
      this._htmlBeforeDisconnect ??
      (this.getAttribute('content') || lightDom);
    this._htmlBeforeDisconnect = null;

    this._editor = createFromConfig(mount, config, {
      content: initialContent,
      onChange: (html) => {
        this.dispatchEvent(new CustomEvent('change', {
          detail:  html,
          bubbles: true,
          composed: true,
        }));
      },
    });
  }

  disconnectedCallback() {
    if (this._editor) this._htmlBeforeDisconnect = this._editor.getHtml();
    this._editor?.destroy();
    this._editor = null;
    this._mount?.remove();   // otherwise every DOM move leaks one orphaned div
    this._mount = null;
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (!this._editor || oldVal === newVal) return;
    if (name === 'content')     this._editor.setHtml(newVal ?? '');
    if (name === 'readonly')    newVal !== null ? this._editor.disable() : this._editor.enable();
    if (name === 'placeholder') {
      this._editor.content.dataset.placeholder = newVal ?? '';
      this._editor.content.setAttribute('aria-placeholder', newVal ?? '');
    }
  }

  // ── Public API (mirrors Editor) ───────────────────────────────

  get editor()         { return this._editor; }
  getHtml()            { return this._editor?.getHtml() ?? ''; }
  setHtml(html)        { this._editor?.setHtml(html); }
  getMarkdown()        { return this._editor?.getMarkdown() ?? ''; }
  print()              { this._editor?.print(); }
  cmd(name, ...args)   { return this._editor?.cmd(name, ...args); }
}

if (!customElements.get('rune-editor')) {
  customElements.define('rune-editor', RuneEditorElement);
}

export { RuneEditorElement };
