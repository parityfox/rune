import { Editor } from '../../src/core/Editor.js';

/**
 * rune — a Svelte action that mounts a Rune Editor on the node.
 *
 *   <script>
 *   import { rune } from '@parityfox/rune-editor/svelte';
 *   import { StarterKit } from '@parityfox/rune-editor';
 *   let html = '<p>Hi</p>';
 *   </script>
 *   <div use:rune={{ extensions: StarterKit, content: html, onChange: (h) => html = h }} />
 *
 * The editor instance is passed to `params.onReady(editor)` and stored on
 * `node.__runeEditor`. Reactive `params` flow through the action's `update`.
 */
export function rune(node, params = {}) {
  let opts = params || {};

  const editor = new Editor(node, {
    ...opts,
    onChange(html, instance) { opts.onChange?.(html, instance); },
  });
  node.__runeEditor = editor;
  if (opts.readOnly) editor.disable();
  opts.onReady?.(editor);

  return {
    update(next = {}) {
      const wasReadOnly = !!opts.readOnly;
      const prevContent = opts.content;
      opts = next || {};
      if (!!opts.readOnly !== wasReadOnly) {
        opts.readOnly ? editor.disable() : editor.enable();
      }
      // Live content binding (#117), guarded so a round-trip of the editor's
      // own onChange value never resets the document (and caret) mid-typing.
      if (opts.content !== undefined && opts.content !== prevContent && opts.content !== editor.getHtml()) {
        editor.setHtml(opts.content);
      }
    },
    destroy() {
      editor.destroy();
      delete node.__runeEditor;
    },
  };
}
