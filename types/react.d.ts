// Type definitions for @parityfox/rune-editor/react
import type * as React from 'react';
import type { Editor, EditorOptions } from './index';

export interface UseRuneResult {
  /** Attach to the mount element: `<div ref={ref} />`. */
  ref: React.RefObject<HTMLDivElement>;
  /** The Editor instance (null until mounted). */
  editor: Editor | null;
  isReady: boolean;
  getHtml(): string;
  setHtml(html: string): void;
  cmd(name: string, ...args: any[]): any;
  focus(): void;
}

export function useRune(options?: EditorOptions): UseRuneResult;

export interface RuneEditorProps extends Partial<EditorOptions> {
  className?: string;
  style?: React.CSSProperties;
  readOnly?: boolean;
}

export const RuneEditor: React.FC<RuneEditorProps>;
