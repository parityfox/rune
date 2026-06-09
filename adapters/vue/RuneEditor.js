import { h, defineComponent, watch } from 'vue';
import { useRune } from './useRune.js';

/**
 * RuneEditor — drop-in Vue 3 component (render-function, no SFC compilation).
 *
 *   <RuneEditor :extensions="StarterKit" content="<p>Hi</p>" @change="onChange" />
 *
 * Exposes the editor instance via a template ref: `ref.editor`.
 */
export const RuneEditor = defineComponent({
  name: 'RuneEditor',
  props: {
    extensions: { type: Array, default: () => [] },
    content: { type: String, default: '' },
    placeholder: { type: String, default: undefined },
    toolbar: { type: [Boolean, Object], default: true },
    bubbleMenu: { type: [Boolean, Object], default: true },
    slashMenu: { type: Boolean, default: true },
    readOnly: { type: Boolean, default: false },
    attribution: { type: Boolean, default: true },
    class: { type: String, default: '' },
  },
  emits: ['change'],
  setup(props, { emit, expose }) {
    const api = useRune({
      extensions: props.extensions,
      content: props.content,
      placeholder: props.placeholder,
      toolbar: props.toolbar,
      bubbleMenu: props.bubbleMenu,
      slashMenu: props.slashMenu,
      readOnly: props.readOnly,
      attribution: props.attribution,
      onChange: (html, instance) => emit('change', html, instance),
    });

    watch(() => props.readOnly, (ro) => {
      if (!api.editor.value) return;
      ro ? api.editor.value.disable() : api.editor.value.enable();
    });

    expose({ editor: api.editor, getHtml: api.getHtml, setHtml: api.setHtml, cmd: api.cmd, focus: api.focus });
    return () => h('div', { ref: api.el, class: `rune-editor-container ${props.class}`.trim() });
  },
});

export default RuneEditor;
