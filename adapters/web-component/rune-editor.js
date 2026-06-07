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
  static get observedAttributes() {
    return ['content', 'placeholder', 'readonly', 'attribution'];
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

    // Mount point — inner div so the custom element itself stays clean
    const mount = document.createElement('div');
    this.appendChild(mount);

    const initialContent =
      this.getAttribute('content') ||
      this.innerHTML.replace(mount.outerHTML, '').trim();

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
    this._editor?.destroy();
    this._editor = null;
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (!this._editor || oldVal === newVal) return;
    if (name === 'content')     this._editor.setHtml(newVal ?? '');
    if (name === 'readonly')    newVal !== null ? this._editor.disable() : this._editor.enable();
    if (name === 'placeholder') this._editor.content.dataset.placeholder = newVal ?? '';
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
