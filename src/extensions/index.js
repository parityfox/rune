// Marks
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

// Blocks
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
import { Table }            from './blocks/Table.js';

// Formatting (block-level)
import { TextAlign }   from './formatting/TextAlign.js';
import { LineHeight }  from './formatting/LineHeight.js';
import { Indent }      from './formatting/Indent.js';
import { Outdent }     from './formatting/Outdent.js';

// Plugins
import { MarkdownShortcuts } from './plugins/MarkdownShortcuts.js';
import { FindReplace }       from './plugins/FindReplace.js';
import { DragReorder }       from './plugins/DragReorder.js';
import { FormatPainter }     from './plugins/FormatPainter.js';

// Named exports
export {
  Bold, Italic, Underline, Strike, Code, Link, Superscript, Subscript,
  FontSize, FontFamily, TextColor, TextBackground,
  Paragraph, Heading, BulletList, OrderedList, Blockquote, CodeBlock,
  HorizontalRule, Callout, TaskList, VideoEmbed, Image, Table,
  TextAlign, LineHeight, Indent, Outdent,
  MarkdownShortcuts, FindReplace, DragReorder, FormatPainter,
};

// StarterKit — everything bundled
export const StarterKit = [
  Paragraph, Heading, BulletList, OrderedList, Blockquote, CodeBlock,
  HorizontalRule, Callout, TaskList, VideoEmbed, Image, Table,
  Bold, Italic, Underline, Strike, Code, Link, Superscript, Subscript,
  FontSize, FontFamily, TextColor, TextBackground,
  TextAlign, LineHeight, Indent, Outdent,
  MarkdownShortcuts, FindReplace, DragReorder, FormatPainter,
];
