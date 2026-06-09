import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '../../src/utils/markdownToHtml.js';
import { htmlToMarkdown } from '../../src/utils/markdown.js';

describe('markdownToHtml (#85)', () => {
  it('headings', () => {
    expect(markdownToHtml('# H1')).toBe('<h1>H1</h1>');
    expect(markdownToHtml('### H3')).toBe('<h3>H3</h3>');
  });

  it('paragraph with bold/italic/code/strike', () => {
    expect(markdownToHtml('a **b** c')).toBe('<p>a <strong>b</strong> c</p>');
    expect(markdownToHtml('*i* `c` ~~s~~')).toBe('<p><em>i</em> <code>c</code> <s>s</s></p>');
  });

  it('links and images', () => {
    expect(markdownToHtml('[x](https://y.com)')).toBe('<p><a href="https://y.com">x</a></p>');
    expect(markdownToHtml('![a](p.png)')).toBe('<p><img src="p.png" alt="a"></p>');
  });

  it('unordered, ordered, and nested lists', () => {
    expect(markdownToHtml('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(markdownToHtml('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
    expect(markdownToHtml('- a\n  - a1\n- b')).toBe('<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul>');
  });

  it('nested blockquotes', () => {
    expect(markdownToHtml('> outer\n>\n>> inner'))
      .toBe('<blockquote><p>outer</p><blockquote>inner</blockquote></blockquote>');
  });

  it('blockquote, fenced code, hr', () => {
    expect(markdownToHtml('> q')).toBe('<blockquote>q</blockquote>');
    expect(markdownToHtml('```js\nconst x=1\n```')).toBe('<pre><code class="language-js">const x=1</code></pre>');
    expect(markdownToHtml('---')).toBe('<hr>');
  });

  it('tables', () => {
    const out = markdownToHtml('| A | B |\n| - | - |\n| 1 | 2 |');
    expect(out).toContain('<thead><tr><th>A</th><th>B</th></tr></thead>');
    expect(out).toContain('<tbody><tr><td>1</td><td>2</td></tr></tbody>');
  });

  it('escapes raw HTML in text', () => {
    expect(markdownToHtml('a <b> & c')).toBe('<p>a &lt;b&gt; &amp; c</p>');
  });

  it('round-trips common syntax through htmlToMarkdown', () => {
    const md = '# Title\n\nSome **bold** and *italic* and `code`.\n\n- one\n- two\n\n> quote';
    const rt = htmlToMarkdown(markdownToHtml(md));
    expect(rt).toBe(md);
  });
});
