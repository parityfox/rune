/**
 * Rune Editor
 *
 * A lightweight, extensible rich text editor.
 * Framework-agnostic — works with vanilla JS, React, Vue, Svelte, and more.
 *
 * Quick start:
 *
 *   import { Editor, StarterKit } from './rune/src/index.js';
 *
 *   const editor = new Editor('#my-div', {
 *     extensions: StarterKit,
 *     content: '<p>Hello Rune!</p>',
 *     onChange(html) { console.log(html); }
 *   });
 */

export { Editor }            from './core/Editor.js';
export { createFromConfig }  from './createFromConfig.js';
export { EventBus }    from './core/EventBus.js';
export { History }     from './core/History.js';
export { Schema }      from './core/Schema.js';
export { Selection }   from './core/Selection.js';

// Extensions
export * from './extensions/index.js';

// Utils (useful for building custom extensions)
export * from './utils/dom.js';
export * from './utils/html.js';
export * from './utils/id.js';
export { htmlToMarkdown } from './utils/markdown.js';
export { markdownToHtml } from './utils/markdownToHtml.js';
