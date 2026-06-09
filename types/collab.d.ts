// Type definitions for @parityfox/rune-editor/collab
import type { Editor } from './index';

export interface PresenceUser {
  id: number;
  name?: string;
  color?: string;
  avatar?: string;
  typing: boolean;
  state: 'active' | 'idle' | 'away';
  cursorBlockId: string | null;
  isSelf: boolean;
}

export interface PresenceHandle {
  getUsers(): PresenceUser[];
  on(event: 'change', fn: (roster: PresenceUser[]) => void): () => void;
  off(event: 'change', fn: (roster: PresenceUser[]) => void): void;
  follow(id: number): void;
  unfollow(): void;
  setUser(patch: { name?: string; color?: string; avatar?: string }): void;
  destroy(): void;
}

export class PresenceBar {
  constructor(presence: PresenceHandle, container?: Element);
  readonly el: HTMLElement;
  destroy(): void;
}

export class WebSocketProvider {
  constructor(url: string, room: string, doc: any, opts?: any);
  readonly doc: any;
  readonly awareness: any;
  readonly synced: boolean;
  destroy(): void;
}
export class MemoryHub { connect(doc: any, awareness?: any): () => void; }
export class CommentStore {
  constructor(doc: any);
  add(t: any): any; reply(id: string, r: any): void; resolve(id: string, resolved?: boolean): void;
  remove(id: string): void; list(): any[]; observe(cb: () => void): void; unobserve(cb: () => void): void;
}
export class SuggestionStore {
  constructor(doc: any);
  accept(id: string): void; reject(id: string): void; acceptAll(): void; rejectAll(): void; list(): any[];
}

export function persistLocally(doc: any, name: string, opts?: { timeout?: number }):
  { whenSynced: Promise<boolean>; synced: boolean; clear(): Promise<void>; destroy(): Promise<void> };
export function bindParagraph(editor: Editor, doc: any): { destroy(): void };
export const bindParagraphSpike: typeof bindParagraph;
export function bindPresence(editor: Editor, doc: any, awareness: any, opts?: { name?: string; color?: string; avatar?: string; onChange?: (r: PresenceUser[]) => void }): PresenceHandle;
export function bindCommentsUI(editor: Editor, doc: any, store: CommentStore, opts?: any): { render(): void; addFromSelection(author: string, text: string): any; destroy(): void };
export function bindSuggestionMode(editor: Editor, doc: any, opts?: { author?: string; color?: string; isEnabled?: () => boolean }): { destroy(): void };

export interface CollabSession {
  presence?: PresenceHandle;
  comments?: CommentStore;
  commentsUI?: { render(): void; destroy(): void };
  suggestions?: SuggestionStore;
  setSuggesting?: (on: boolean) => void;
  isSuggesting?: () => boolean;
  destroy(): void;
}

export function collab(
  editor: Editor,
  provider: { doc: any; awareness?: any },
  options?: {
    user?: { name: string; color: string; avatar?: string };
    presence?: boolean;
    comments?: boolean;
    suggestions?: boolean | { enabled?: boolean };
    onPresence?: (roster: PresenceUser[]) => void;
    onComments?: (threads: any[]) => void;
  },
): CollabSession;
