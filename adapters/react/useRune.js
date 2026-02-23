import { useEffect, useRef, useCallback, useState } from 'react';
import { Editor } from '../../src/core/Editor.js';

/**
 * useRune — React hook for Rune Editor.
 *
 * Usage:
 *   const { ref, editor } = useRune({
 *     extensions: StarterKit,
 *     content: '<p>Hello</p>',
 *     onChange(html) { setValue(html); }
 *   });
 *
 *   return <div ref={ref} />;
 */
export function useRune(options = {}) {
  const ref = useRef(null);
  const editorRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!ref.current) return;

    const editor = new Editor(ref.current, {
      ...optionsRef.current,
      onChange(html, editorInstance) {
        optionsRef.current.onChange?.(html, editorInstance);
      },
    });

    editorRef.current = editor;
    setIsReady(true);

    return () => {
      editor.destroy();
      editorRef.current = null;
      setIsReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getHtml = useCallback(() => editorRef.current?.getHtml() ?? '', []);
  const setHtml = useCallback((html) => editorRef.current?.setHtml(html), []);
  const cmd     = useCallback((name, ...args) => editorRef.current?.cmd(name, ...args), []);
  const focus   = useCallback(() => editorRef.current?.focus(), []);

  return {
    ref,
    editor: editorRef.current,
    isReady,
    getHtml,
    setHtml,
    cmd,
    focus,
  };
}
