// Type definitions for @parityfox/rune-editor/web-component
import type { Editor } from './index';

/** The `<rune-editor>` custom element. */
export class RuneEditorElement extends HTMLElement {
  /** The underlying Editor instance (available after connectedCallback). */
  readonly editor: Editor | undefined;
  getHtml(): string;
  setHtml(html: string): void;
  getMarkdown(): string;
  print(): void;
  cmd(name: string, ...args: any[]): any;
}

declare global {
  interface HTMLElementTagNameMap {
    'rune-editor': RuneEditorElement;
  }
}
