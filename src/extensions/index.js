// Marks
export { Bold }           from './marks/Bold.js';
export { Italic }         from './marks/Italic.js';
export { Underline }      from './marks/Underline.js';
export { Strike }         from './marks/Strike.js';
export { Code }           from './marks/Code.js';
export { Link }           from './marks/Link.js';
export { Superscript }    from './marks/Superscript.js';
export { Subscript }      from './marks/Subscript.js';
export { FontSize }       from './marks/FontSize.js';
export { FontFamily }     from './marks/FontFamily.js';
export { TextColor }      from './marks/TextColor.js';
export { TextBackground } from './marks/TextBackground.js';

// Blocks
export { Paragraph }        from './blocks/Paragraph.js';
export { Heading }          from './blocks/Heading.js';
export { BulletList }       from './blocks/BulletList.js';
export { OrderedList }      from './blocks/OrderedList.js';
export { Blockquote }       from './blocks/Blockquote.js';
export { CodeBlock }        from './blocks/CodeBlock.js';
export { HorizontalRule }   from './blocks/HorizontalRule.js';
export { Image }            from './blocks/Image.js';

// StarterKit — everything bundled
import { Bold }           from './marks/Bold.js';
import { Italic }         from './marks/Italic.js';
import { Underline }      from './marks/Underline.js';
import { Strike }         from './marks/Strike.js';
import { Code }           from './marks/Code.js';
import { Link }           from './marks/Link.js';
import { Superscript }    from './marks/Superscript.js';
import { Subscript }      from './marks/Subscript.js';
import { FontSize }       from './marks/FontSize.js';
import { FontFamily }     from './marks/FontFamily.js';
import { TextColor }      from './marks/TextColor.js';
import { TextBackground } from './marks/TextBackground.js';
import { Paragraph }      from './blocks/Paragraph.js';
import { Heading }        from './blocks/Heading.js';
import { BulletList }     from './blocks/BulletList.js';
import { OrderedList }    from './blocks/OrderedList.js';
import { Blockquote }     from './blocks/Blockquote.js';
import { CodeBlock }      from './blocks/CodeBlock.js';
import { HorizontalRule } from './blocks/HorizontalRule.js';
import { Image }          from './blocks/Image.js';

export const StarterKit = [
  Paragraph, Heading, BulletList, OrderedList, Blockquote, CodeBlock, HorizontalRule, Image,
  Bold, Italic, Underline, Strike, Code, Link, Superscript, Subscript,
  FontSize, FontFamily, TextColor, TextBackground,
];
