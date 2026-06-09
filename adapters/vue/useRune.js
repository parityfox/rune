import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue';
import { Editor } from '../../src/core/Editor.js';

/**
 * useRune — Vue 3 composable for Rune Editor.
 *
 * Usage:
 *   <script setup>
 *   import { useRune } from '@parityfox/rune-editor/vue';
 *   const { el, editor, getHtml } = useRune({ extensions: StarterKit, content: '<p>Hi</p>' });
 *   </script>
 *   <template><div ref="el" /></template>
 */
export function useRune(options = {}) {
  const el = ref(null);
  const editor = shallowRef(null);

  onMounted(() => {
    if (!el.value) return;
    editor.value = new Editor(el.value, {
      ...options,
      onChange(html, instance) { options.onChange?.(html, instance); },
    });
    if (options.readOnly) editor.value.disable();
  });

  onBeforeUnmount(() => {
    editor.value?.destroy();
    editor.value = null;
  });

  // Sync readOnly when options is reactive (e.g. a reactive() object or refs).
  watch(() => options.readOnly, (ro) => {
    if (!editor.value) return;
    ro ? editor.value.disable() : editor.value.enable();
  });

  return {
    el,
    editor,
    getHtml: () => editor.value?.getHtml() ?? '',
    setHtml: (html) => editor.value?.setHtml(html),
    cmd: (name, ...args) => editor.value?.cmd(name, ...args),
    focus: () => editor.value?.focus(),
  };
}
