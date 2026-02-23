import { Editor }          from './core/Editor.js';
import { Bold }            from './extensions/marks/Bold.js';
import { Italic }          from './extensions/marks/Italic.js';
import { Underline }       from './extensions/marks/Underline.js';
import { Strike }          from './extensions/marks/Strike.js';
import { Code }            from './extensions/marks/Code.js';
import { Link }            from './extensions/marks/Link.js';
import { Superscript }     from './extensions/marks/Superscript.js';
import { Subscript }       from './extensions/marks/Subscript.js';
import { FontSize }        from './extensions/marks/FontSize.js';
import { FontFamily }      from './extensions/marks/FontFamily.js';
import { TextColor }       from './extensions/marks/TextColor.js';
import { TextBackground }  from './extensions/marks/TextBackground.js';
import { Paragraph }       from './extensions/blocks/Paragraph.js';
import { Heading }         from './extensions/blocks/Heading.js';
import { BulletList }      from './extensions/blocks/BulletList.js';
import { OrderedList }     from './extensions/blocks/OrderedList.js';
import { Blockquote }      from './extensions/blocks/Blockquote.js';
import { CodeBlock }       from './extensions/blocks/CodeBlock.js';
import { HorizontalRule }  from './extensions/blocks/HorizontalRule.js';
import { Image }           from './extensions/blocks/Image.js';

// Map config keys → extension objects
const BLOCK_MAP = {
  paragraph:      Paragraph,
  heading:        Heading,
  bulletList:     BulletList,
  orderedList:    OrderedList,
  blockquote:     Blockquote,
  codeBlock:      CodeBlock,
  horizontalRule: HorizontalRule,
  image:          Image,
};

const MARK_MAP = {
  bold:           Bold,
  italic:         Italic,
  underline:      Underline,
  strike:         Strike,
  code:           Code,
  link:           Link,
  superscript:    Superscript,
  subscript:      Subscript,
  fontSize:       FontSize,
  fontFamily:     FontFamily,
  textColor:      TextColor,
  textBackground: TextBackground,
};

/**
 * createFromConfig(target, config, overrides?)
 *
 * Builds and returns a Rune Editor instance driven entirely by rune.config.js.
 *
 * @param {string|Element} target   - CSS selector or DOM element
 * @param {object}         config   - imported from rune.config.js
 * @param {object}         overrides - optional extra Editor options (content, onChange, …)
 * @returns {Editor}
 *
 * Usage:
 *   import config from '../rune.config.js';
 *   import { createFromConfig } from '../src/createFromConfig.js';
 *
 *   const editor = createFromConfig('#app', config, {
 *     content: '<p>Hello</p>',
 *     onChange(html) { console.log(html); }
 *   });
 */
export function createFromConfig(target, config, overrides = {}) {
  const { blocks = {}, marks = {}, toolbar = {}, bubbleMenu = {}, slashMenu = {}, editor: editorCfg = {}, history: historyCfg = {} } = config;

  // ── Resolve enabled extensions ─────────────────────────────
  const extensions = [];

  for (const [key, ext] of Object.entries(BLOCK_MAP)) {
    if (blocks[key] !== false) extensions.push(ext);
  }
  for (const [key, ext] of Object.entries(MARK_MAP)) {
    if (marks[key] !== false) extensions.push(ext);
  }

  // ── Resolve toolbar items (skip disabled features) ─────────
  const enabledNames = new Set([
    ...Object.entries(blocks).filter(([, v]) => v !== false).map(([k]) => k),
    ...Object.entries(marks).filter(([, v]) => v !== false).map(([k]) => k),
    'clearFormat', // always available
  ]);

  const toolbarItems = toolbar.enabled === false
    ? false
    : {
        items: (toolbar.items || []).filter(item => item === '|' || enabledNames.has(item)),
      };

  const bubbleMenuOpt = bubbleMenu.enabled === false
    ? false
    : {
        items: (bubbleMenu.items || []).filter(item => item === '|' || enabledNames.has(item)),
      };

  const slashMenuOpt = slashMenu.enabled === false ? false : true;

  // ── Build final Editor options ──────────────────────────────
  const options = {
    extensions,
    toolbar:    toolbarItems,
    bubbleMenu: bubbleMenuOpt,
    slashMenu:  slashMenuOpt,
    placeholder: editorCfg.placeholder ?? 'Write something…',
    ...overrides,
  };

  const ed = new Editor(target, options);

  // Apply config-driven DOM attributes
  if (editorCfg.spellcheck === false) {
    ed.content.setAttribute('spellcheck', 'false');
  }
  if (editorCfg.readOnly) {
    ed.disable();
  }
  if (editorCfg.autofocus) {
    setTimeout(() => ed.focus(), 0);
  }

  // History limits
  if (historyCfg.enabled === false) {
    ed.history.maxSize = 0;
  } else if (historyCfg.maxSteps) {
    ed.history.maxSize = historyCfg.maxSteps;
  }

  return ed;
}
