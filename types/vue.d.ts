// Type definitions for @parityfox/rune-editor/vue
import type { Ref, ShallowRef, DefineComponent } from 'vue';
import type { Editor, EditorOptions } from './index';

export interface UseRuneResult {
  /** Bind to the mount element: `<div ref="el" />`. */
  el: Ref<HTMLElement | null>;
  /** The Editor instance (null until mounted). */
  editor: ShallowRef<Editor | null>;
  getHtml(): string;
  setHtml(html: string): void;
  cmd(name: string, ...args: any[]): any;
  focus(): void;
}

export function useRune(options?: EditorOptions): UseRuneResult;

export interface RuneEditorProps extends Partial<EditorOptions> {
  class?: string;
  readOnly?: boolean;
}

export const RuneEditor: DefineComponent<RuneEditorProps>;
export default RuneEditor;
