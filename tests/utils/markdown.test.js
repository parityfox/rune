import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from '../../src/utils/markdown.js';

describe('htmlToMarkdown', () => {
  it('converts headings', () => {
    expect(htmlToMarkdown('<h1>Title</h1>')).toBe('# Title');
    expect(htmlToMarkdown('<h2>Sub</h2>')).toBe('## Sub');
    expect(htmlToMarkdown('<h3>Sub2</h3>')).toBe('### Sub2');
  });

  it('converts paragraphs', () => {
    expect(htmlToMarkdown('<p>Hello world</p>')).toBe('Hello world');
  });

  it('converts horizontal rules', () => {
    expect(htmlToMarkdown('<hr>')).toBe('---');
  });

  it('converts bold', () => {
    expect(htmlToMarkdown('<p><strong>bold</strong></p>')).toBe('**bold**');
  });

  it('converts italic', () => {
    expect(htmlToMarkdown('<p><em>italic</em></p>')).toBe('*italic*');
  });

  it('converts strikethrough', () => {
    expect(htmlToMarkdown('<p><s>struck</s></p>')).toBe('~~struck~~');
  });

  it('converts inline code', () => {
    expect(htmlToMarkdown('<p><code>code</code></p>')).toBe('`code`');
  });

  it('converts links', () => {
    const result = htmlToMarkdown('<p><a href="https://example.com">link</a></p>');
    expect(result).toContain('[link]');
    expect(result).toContain('example.com');
  });

  it('escapes brackets in link text so the syntax is not broken (#33)', () => {
    const result = htmlToMarkdown('<p><a href="https://x.com">a [b] c</a></p>');
    expect(result).toBe('[a \\[b\\] c](https://x.com)');
  });

  it('wraps URLs containing parentheses/spaces in angle brackets (#33)', () => {
    const result = htmlToMarkdown('<p><a href="https://x.com/a(b)">t</a></p>');
    expect(result).toBe('[t](<https://x.com/a(b)>)');
  });

  it('preserves relative hrefs instead of resolving to absolute (#33)', () => {
    const result = htmlToMarkdown('<p><a href="/docs/page">t</a></p>');
    expect(result).toBe('[t](/docs/page)');
  });

  it('converts unordered lists', () => {
    const result = htmlToMarkdown('<ul><li>a</li><li>b</li></ul>');
    expect(result).toBe('- a\n- b');
  });

  it('converts ordered lists', () => {
    const result = htmlToMarkdown('<ol><li>a</li><li>b</li></ol>');
    expect(result).toBe('1. a\n2. b');
  });

  it('indents nested lists instead of flattening them (#35)', () => {
    const result = htmlToMarkdown('<ul><li>a<ul><li>a1</li><li>a2</li></ul></li><li>b</li></ul>');
    expect(result).toBe('- a\n  - a1\n  - a2\n- b');
  });

  it('keeps inline marks inside task items (#35)', () => {
    const html = '<ul class="rune-task-list"><li class="rune-task-item" data-checked="true">' +
      '<span class="rune-task-content">do <strong>bold</strong></span></li></ul>';
    expect(htmlToMarkdown(html)).toBe('- [x] do **bold**');
  });

  it('converts code blocks', () => {
    const result = htmlToMarkdown('<pre><code>const x = 1;</code></pre>');
    expect(result).toBe('```\nconst x = 1;\n```');
  });

  it('uses a longer fence when code contains triple backticks (#34)', () => {
    const result = htmlToMarkdown('<pre><code>```js\ncode\n```</code></pre>');
    expect(result).toBe('````\n```js\ncode\n```\n````');
  });

  it('lengthens inline code delimiters around embedded backticks (#34)', () => {
    const result = htmlToMarkdown('<p><code>a`b</code></p>');
    expect(result).toBe('`` a`b ``');
  });

  it('converts blockquotes', () => {
    const result = htmlToMarkdown('<blockquote>quote text</blockquote>');
    expect(result).toContain('> quote text');
  });

  it('converts tables', () => {
    const result = htmlToMarkdown(
      '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>'
    );
    expect(result).toContain('| A | B |');
    expect(result).toContain('| --- | --- |');
    expect(result).toContain('| 1 | 2 |');
  });

  it('converts multiple blocks', () => {
    const result = htmlToMarkdown('<h1>Title</h1><p>Body</p>');
    expect(result).toBe('# Title\n\nBody');
  });

  it('handles nested inline formatting', () => {
    const result = htmlToMarkdown('<p><strong><em>bold italic</em></strong></p>');
    expect(result).toBe('***bold italic***');
  });
});
