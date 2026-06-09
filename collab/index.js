/**
 * Rune collaboration — public entry point.
 *
 * Real-time multi-user editing on Yjs: live presence, threaded comments,
 * tracked-change suggestions, and offline persistence. Requires the optional
 * peer deps (yjs, y-protocols, y-websocket and/or y-indexeddb).
 *
 *   import { Editor } from '@parityfox/rune-editor';
 *   import { WebSocketProvider, collab } from '@parityfox/rune-editor/collab';
 *
 *   const editor = new Editor('#app', { extensions: StarterKit });
 *   const provider = new WebSocketProvider('wss://your-host', 'doc-1', new Y.Doc());
 *   const session = collab(editor, provider, {
 *     user: { name: 'Ada', color: '#e03e3e' },
 *     presence: true, comments: true, suggestions: true,
 *   });
 *   // session.presence / session.comments / session.suggestions
 *   // session.destroy()  (also runs automatically on editor.destroy())
 */

export { WebSocketProvider } from './provider.js';
export { MemoryHub } from './memory-hub.js';
export { persistLocally } from './providers/indexeddb.js';
export { bindParagraph, bindParagraphSpike } from './paragraph-binding.js';
export { bindPresence } from './presence.js';
export { CommentStore } from './comments.js';
export { bindCommentsUI } from './comments-ui.js';
export { SuggestionStore } from './suggestions.js';
export { bindSuggestionMode } from './suggestion-mode.js';
export { PresenceBar } from '../src/ui/PresenceBar.js';

import { bindParagraph } from './paragraph-binding.js';
import { bindPresence } from './presence.js';
import { CommentStore } from './comments.js';
import { bindCommentsUI } from './comments-ui.js';
import { SuggestionStore } from './suggestions.js';
import { bindSuggestionMode } from './suggestion-mode.js';

/**
 * Wire collaboration features onto an editor in one call.
 *
 * @param {object} editor   a Rune Editor instance
 * @param {object} provider an object exposing `.doc` (Y.Doc) and `.awareness`
 *   (e.g. WebSocketProvider), or a raw `{ doc, awareness }`.
 * @param {object} [options]
 * @param {{name:string,color:string}} [options.user]
 * @param {boolean} [options.presence=true]
 * @param {boolean} [options.comments=false]
 * @param {boolean|{enabled?:boolean}} [options.suggestions=false]
 * @param {(roster:any[])=>void} [options.onPresence]
 * @param {(threads:any[])=>void} [options.onComments]
 * @returns {{ presence?, comments?, commentsUI?, suggestions?, setSuggesting?, isSuggesting?, destroy():void }}
 */
export function collab(editor, provider, options = {}) {
  const {
    user = { name: 'Anon', color: '#888' },
    presence = true,
    comments = false,
    suggestions = false,
    onPresence,
    onComments,
  } = options;

  const doc = provider.doc || provider;
  const awareness = provider.awareness;
  const teardowns = [];
  const handle = {
    destroy() { while (teardowns.length) { try { teardowns.pop()(); } catch { /* ignore */ } } },
  };

  teardowns.push(bindParagraph(editor, doc).destroy);

  if (presence && awareness) {
    handle.presence = bindPresence(editor, doc, awareness, { name: user.name, color: user.color, onChange: onPresence });
    teardowns.push(handle.presence.destroy);
  }

  if (comments) {
    handle.comments = new CommentStore(doc);
    handle.commentsUI = bindCommentsUI(editor, doc, handle.comments, { onChange: onComments });
    teardowns.push(handle.commentsUI.destroy);
  }

  if (suggestions) {
    handle.suggestions = new SuggestionStore(doc);
    let enabled = suggestions !== true && !!suggestions.enabled;
    const mode = bindSuggestionMode(editor, doc, {
      author: user.name, color: user.color, isEnabled: () => enabled,
    });
    handle.setSuggesting = (on) => { enabled = !!on; };
    handle.isSuggesting = () => enabled;
    teardowns.push(mode.destroy);
  }

  // Tear down with the editor too (each binding also self-registers, but the
  // aggregate handle gives the consumer one destroy()).
  editor.events.on('destroy', handle.destroy);
  return handle;
}
