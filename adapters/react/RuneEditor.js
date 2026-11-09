import { createElement } from 'react';
import { useRune } from './useRune.js';

/**
 * RuneEditor — drop-in React component.
 *
 * Plain JS (no JSX) on purpose: bundlers don't compile JSX inside
 * node_modules, so shipping JSX breaks consumers' production builds.
 *
 * Usage (Next.js):
 *   import dynamic from 'next/dynamic';
 *   const RuneEditor = dynamic(
 *     () => import('@parityfox/rune-editor/react').then((m) => m.RuneEditor),
 *     { ssr: false },
 *   );
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
  attribution = true,
}) {
  const { ref } = useRune({
    extensions,
    content,
    onChange,
    placeholder,
    toolbar,
    bubbleMenu,
    slashMenu,
    readOnly,
    attribution,
  });

  return createElement('div', {
    ref,
    className: `rune-editor-container ${className}`,
    style,
  });
}
