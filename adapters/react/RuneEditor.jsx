import { useRune } from './useRune.js';

/**
 * RuneEditor — drop-in React component.
 *
 * Usage (Next.js):
 *   import dynamic from 'next/dynamic';
 *   const RuneEditor = dynamic(() => import('../../rune/adapters/react/RuneEditor.jsx'), { ssr: false });
 *
 *   <RuneEditor
 *     extensions={StarterKit}
 *     content="<p>Hello world</p>"
 *     onChange={(html) => console.log(html)}
 *     className="my-editor"
 *     placeholder="Start writing..."
 *   />
 */
export default function RuneEditor({
  extensions = [],
  content = '',
  onChange,
  placeholder,
  toolbar = true,
  bubbleMenu = true,
  slashMenu = true,
  className = '',
  style,
  readOnly = false,
}) {
  const { ref } = useRune({
    extensions,
    content,
    onChange,
    placeholder,
    toolbar,
    bubbleMenu,
    slashMenu,
  });

  return (
    <div
      ref={ref}
      className={`rune-editor-container ${className}`}
      style={style}
      data-readonly={readOnly || undefined}
    />
  );
}
