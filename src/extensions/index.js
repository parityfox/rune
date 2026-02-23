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
export { Callout }          from './blocks/Callout.js';
export { TaskList }         from './blocks/TaskList.js';
export { VideoEmbed }       from './blocks/VideoEmbed.js';
export { Image }            from './blocks/Image.js';
export { Table }            from './blocks/Table.js';

// Formatting (block-level)
export { TextAlign }   from './formatting/TextAlign.js';
export { LineHeight }  from './formatting/LineHeight.js';
export { Indent }      from './formatting/Indent.js';
export { Outdent }     from './formatting/Outdent.js';

// Plugins
export { MarkdownShortcuts } from './plugins/MarkdownShortcuts.js';
export { FindReplace }       from './plugins/FindReplace.js';
export { DragReorder }       from './plugins/DragReorder.js';

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
import { Paragraph }        from './blocks/Paragraph.js';
import { Heading }          from './blocks/Heading.js';
import { BulletList }       from './blocks/BulletList.js';
import { OrderedList }      from './blocks/OrderedList.js';
import { Blockquote }       from './blocks/Blockquote.js';
import { CodeBlock }        from './blocks/CodeBlock.js';
import { HorizontalRule }   from './blocks/HorizontalRule.js';
import { Callout }          from './blocks/Callout.js';
import { TaskList }         from './blocks/TaskList.js';
import { VideoEmbed }       from './blocks/VideoEmbed.js';
import { Image }            from './blocks/Image.js';
import { Table }        from './blocks/Table.js';
import { TextAlign }   from './formatting/TextAlign.js';
import { LineHeight }  from './formatting/LineHeight.js';
import { Indent }      from './formatting/Indent.js';
import { Outdent }     from './formatting/Outdent.js';
import { MarkdownShortcuts } from './plugins/MarkdownShortcuts.js';
import { FindReplace }       from './plugins/FindReplace.js';
import { DragReorder }       from './plugins/DragReorder.js';

export const StarterKit = [
  Paragraph, Heading, BulletList, OrderedList, Blockquote, CodeBlock,
  HorizontalRule, Callout, TaskList, VideoEmbed, Image, Table,
  Bold, Italic, Underline, Strike, Code, Link, Superscript, Subscript,
  FontSize, FontFamily, TextColor, TextBackground,
  TextAlign, LineHeight, Indent, Outdent,
  MarkdownShortcuts, FindReplace, DragReorder,
];
