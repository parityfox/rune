// Type definitions for @parityfox/rune-editor
// Hand-authored to match src/index.js.

export interface EditorHistory {
  save(): void;
  saveNow(): void;
  undo(): boolean;
  redo(): boolean;
  destroy?(): void;
}

export interface EditorOptions {
  /** Initial HTML content. */
  content?: string;
  /** Extensions to register (marks, blocks, formatting, plugins). */
  extensions?: Extension[];
  /** `true` for the default toolbar, an items config, or `false` to disable. */
  toolbar?: boolean | { items?: string[] };
  bubbleMenu?: boolean | { items?: string[] };
  slashMenu?: boolean;
  placeholder?: string;
  /** Accessible name for the editable region. */
  ariaLabel?: string;
  /** "Made with Rune" credit; set `false` to remove. */
  attribution?: boolean;
  /** Fires on user edits, undo/redo, and programmatic setHtml (not on initial content). */
  onChange?: (html: string, editor: Editor) => void;
  /** Custom history implementation or factory (e.g. a Yjs adapter). */
  history?: EditorHistory | ((editor: Editor) => EditorHistory);
  /** Async image upload hook returning the hosted URL. */
  uploadImage?: (file: File) => Promise<string>;
  [key: string]: unknown;
}

export type ExtensionType = 'mark' | 'block' | 'formatting' | 'plugin';

export interface ToolbarItem {
  name: string;
  title: string;
  icon: string;
  action?: string;
  args?: unknown[];
  type?: 'panel';
  dropdown?: Array<{ label: string; action: string; args?: unknown[] }>;
  isActive?: (editor: Editor) => boolean;
  renderPanel?: (editor: Editor, close: () => void, item: ToolbarItem) => HTMLElement;
  [key: string]: unknown;
}

export interface SlashItem {
  icon: string;
  title: string;
  description?: string;
  action: (editor: Editor) => void;
}

export interface Extension {
  name: string;
  type: ExtensionType;
  tag?: string | string[];
  match?: (el: Element) => boolean;
  execCommand?: string;
  toggleCommand?: string;
  commands?: (editor: Editor) => Record<string, (...args: any[]) => any>;
  keymap?: Record<string, (editor: Editor) => void>;
  init?: (editor: Editor) => void;
  toolbarItem?: ToolbarItem;
  slashItem?: SlashItem;
  [key: string]: unknown;
}

export interface SavedRange {
  startContainer: Node;
  startOffset: number;
  endContainer: Node;
  endOffset: number;
}

export class EventBus {
  on(event: string, fn: (...args: any[]) => void): this;
  once(event: string, fn: (...args: any[]) => void): this;
  off(event: string, fn: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): this;
  removeAllListeners(event?: string): this;
}

/** Chainable command builder; unknown methods are treated as command names. */
export interface CommandChain {
  run(): boolean;
  [command: string]: (...args: any[]) => CommandChain;
}

export class Selection {
  constructor(editor: Editor);
  readonly native: globalThis.Selection | null;
  readonly range: Range | null;
  readonly isCollapsed: boolean;
  save(): SavedRange | null;
  restore(saved: SavedRange | null): void;
  getBlock(): HTMLElement | null;
  getFormattingTarget(): HTMLElement | null;
  getSelectedBlocks(): HTMLElement[];
  setAtEnd(el: Element): void;
  setAtStart(el: Element): void;
  selectAll(el: Element): void;
  isAtBlockStart(): boolean;
  isAtBlockEnd(): boolean;
}

export class History implements EditorHistory {
  constructor(editor: Editor, opts?: { maxSize?: number; maxBytes?: number; debounce?: number });
  save(): void;
  saveNow(): void;
  undo(): boolean;
  redo(): boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  destroy(): void;
}

export class Schema {
  register(ext: Extension): void;
  getBlock(name: string): Extension | undefined;
  getMark(name: string): Extension | undefined;
  getToolbarItems(): ToolbarItem[];
  getSlashItems(): SlashItem[];
  getKeymap(): Record<string, (editor: Editor) => void>;
  readonly plugins: Extension[];
}

export class Editor {
  constructor(target: string | Element, options?: EditorOptions);

  readonly content: HTMLElement;
  readonly wrapper: HTMLElement;
  readonly target: HTMLElement;
  readonly events: EventBus;
  readonly schema: Schema;
  readonly selection: Selection;
  history: EditorHistory;
  options: EditorOptions;

  /** Run a registered command by name. */
  cmd(name: string, ...args: any[]): any;
  /** Begin a command chain: `editor.chain().toggleBold().run()`. */
  chain(): CommandChain;
  /** Whether a mark/block is active at the caret. */
  isActive(type: string, attrs?: Record<string, unknown>): boolean;

  getHtml(): string;
  setHtml(html: string): void;
  getText(): string;
  getMarkdown(): string;
  print(): void;
  isEmpty(): boolean;

  focus(): this;
  blur(): this;
  enable(): this;
  disable(): this;

  /** Announce a message to assistive technology via the live region. */
  announce(msg: string): void;
  /** Swap the undo/redo implementation (used by the collab binding). */
  replaceHistory(impl: EditorHistory): void;
  destroy(): void;
}

export interface RuneConfig {
  blocks?: Record<string, boolean>;
  marks?: Record<string, boolean>;
  formatting?: Record<string, boolean>;
  plugins?: Record<string, boolean>;
  toolbar?: { enabled?: boolean; items?: string[] };
  bubbleMenu?: { enabled?: boolean; items?: string[] };
  slashMenu?: { enabled?: boolean };
  editor?: {
    placeholder?: string;
    spellcheck?: boolean;
    autofocus?: boolean;
    readOnly?: boolean;
    attribution?: boolean;
    uploadImage?: (file: File) => Promise<string>;
  };
  history?: { enabled?: boolean; maxSteps?: number; maxBytes?: number };
}

export function createFromConfig(
  target: string | Element,
  config: RuneConfig,
  overrides?: Partial<EditorOptions>,
): Editor;

// ── Extensions ────────────────────────────────────────────────
export const StarterKit: Extension[];
export const Blocks: Extension[];
export const Marks: Extension[];
export const Formatting: Extension[];
export const Plugins: Extension[];

export const Bold: Extension;
export const Italic: Extension;
export const Underline: Extension;
export const Strike: Extension;
export const Code: Extension;
export const Link: Extension;
export const Superscript: Extension;
export const Subscript: Extension;
export const FontSize: Extension;
export const FontFamily: Extension;
export const TextColor: Extension;
export const TextBackground: Extension;
export const Paragraph: Extension;
export const Heading: Extension;
export const BulletList: Extension;
export const OrderedList: Extension;
export const Blockquote: Extension;
export const CodeBlock: Extension;
export const HorizontalRule: Extension;
export const Callout: Extension;
export const TaskList: Extension;
export const VideoEmbed: Extension;
export const Image: Extension;
export const Table: Extension;
export const TextAlign: Extension;
export const LineHeight: Extension;
export const Indent: Extension;
export const Outdent: Extension;
export const ClearFormat: Extension;
export const MarkdownShortcuts: Extension;
export const FindReplace: Extension;
export const DragReorder: Extension;
export const FormatPainter: Extension;

// ── Utilities ─────────────────────────────────────────────────
export function el(tag: string, attrs?: Record<string, any>, ...children: Array<Node | string>): HTMLElement;
export function closest(node: Node | null, selector: string): Element | null;
export function isInside(node: Node | null, container: Node): boolean;
export function getBlockElement(node: Node | null, root: Element): HTMLElement | null;
export function removeAllChildren(el: Element): void;
export function getCaretRect(): DOMRect | null;
export function getSelectionRect(): DOMRect | null;
export function htmlToMarkdown(html: string): string;
export function uid(): string;
export function sanitize(html: string): string;
export function sanitizeContent(html: string): string;
export function normalizeHtml(html: string): string;
