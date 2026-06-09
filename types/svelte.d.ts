// Type definitions for @parityfox/rune-editor/svelte
import type { Editor, EditorOptions } from './index';

export interface RuneActionParams extends Partial<EditorOptions> {
  readOnly?: boolean;
  /** Called once with the Editor instance after it mounts. */
  onReady?: (editor: Editor) => void;
}

export interface ActionReturn {
  update(params: RuneActionParams): void;
  destroy(): void;
}

/** Svelte action: `<div use:rune={{ extensions, content, onChange }} />`. */
export function rune(node: HTMLElement, params?: RuneActionParams): ActionReturn;
