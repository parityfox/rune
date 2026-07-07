import { describe, it, expect } from 'vitest';
import { htmlToJson, jsonToHtml } from '../../src/utils/json.js';

describe('JSON document model (#83)', () => {
  it('parses headings, paragraphs, and marks', () => {
    const doc = htmlToJson('<h2>Title</h2><p>a <strong>b</strong> c</p>');
    expect(doc).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [
          { type: 'text', text: 'a ' },
          { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' c' },
        ] },
      ],
    });
  });

  it('renders JSON to HTML with no DOM', () => {
    const html = jsonToHtml({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'bold' }] }] },
    ] });
    expect(html).toBe('<p><strong>x</strong></p>');
  });

  it('round-trips common blocks and marks', () => {
    const html = '<h1>H</h1><p>a <strong><em>bi</em></strong> <a href="https://x.com">l</a></p>' +
      '<ul><li>one</li><li>two</li></ul><blockquote>q</blockquote>' +
      '<pre><code class="language-js">code</code></pre><hr>';
    expect(jsonToHtml(htmlToJson(html))).toBe(html);
  });

  it('preserves mark nesting order', () => {
    const html = '<p><strong><em>x</em></strong></p>';
    expect(jsonToHtml(htmlToJson(html))).toBe(html);
  });

  it('passes unknown blocks through losslessly', () => {
    const html = '<table><tbody><tr><td>x</td></tr></tbody></table>';
    const doc = htmlToJson(html);
    expect(doc.content[0].type).toBe('html');
    expect(jsonToHtml(doc)).toBe(html);
  });

  // #125: the { type:'html' } passthrough was emitted verbatim, so
  // jsonToHtml(htmlToJson(untrusted)) round-tripped raw script. Sanitize it
  // where a DOM is available (creation in htmlToJson; render in jsonToHtml).
  describe('passthrough html is sanitized (#125)', () => {
    it('sanitizes html manufactured by htmlToJson from untrusted input', () => {
      const out = jsonToHtml(htmlToJson('<div><img src=x onerror="alert(1)"></div>'));
      expect(out).not.toContain('onerror');
    });

    it('sanitizes a hand-built html passthrough node when a DOM is available', () => {
      const out = jsonToHtml({ type: 'doc', content: [{ type: 'html', html: '<img src=x onerror="alert(1)">' }] });
      expect(out).not.toContain('onerror');
    });

    it('drops a script tag in passthrough while keeping safe markup', () => {
      const out = jsonToHtml({ type: 'doc', content: [{ type: 'html', html: '<div>ok</div><script>alert(1)</script>' }] });
      expect(out).not.toContain('<script');
      expect(out).toContain('ok');
    });
  });

  it('escapes text in jsonToHtml', () => {
    expect(jsonToHtml({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a <b> & c' }] }] }))
      .toBe('<p>a &lt;b&gt; &amp; c</p>');
  });

  describe('jsonToHtml output is XSS-safe standalone (#100)', () => {
    const doc = (marks) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks }] }] });

    it('drops a javascript: href on a link mark', () => {
      expect(jsonToHtml(doc([{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])))
        .toBe('<p><a href="">x</a></p>');
    });

    it('keeps a safe href', () => {
      expect(jsonToHtml(doc([{ type: 'link', attrs: { href: 'https://y.com' } }])))
        .toBe('<p><a href="https://y.com">x</a></p>');
    });

    it('escapes quotes in an href so it cannot break out of the attribute', () => {
      const out = jsonToHtml(doc([{ type: 'link', attrs: { href: 'https://y.com" onmouseover="alert(1)' } }]));
      expect(out).not.toContain('" onmouseover="');
      expect(out).toContain('&quot;');
    });

    it('escapes quotes in a code-block language attribute', () => {
      const out = jsonToHtml({ type: 'doc', content: [
        { type: 'codeBlock', attrs: { language: 'js"><script>' }, content: [{ type: 'text', text: 'x' }] },
      ] });
      expect(out).not.toContain('"><script>');
      expect(out).toContain('&quot;');
    });
  });
});
