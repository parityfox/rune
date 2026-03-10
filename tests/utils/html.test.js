import { describe, it, expect } from 'vitest';
import { sanitize, _isDangerousUrl, normalizeHtml } from '../../src/utils/html.js';

describe('_isDangerousUrl', () => {
  it('blocks javascript: URIs', () => {
    expect(_isDangerousUrl('javascript:alert(1)')).toBe(true);
  });

  it('blocks javascript: with whitespace bypass', () => {
    expect(_isDangerousUrl('  javascript:alert(1)')).toBe(true);
    expect(_isDangerousUrl('java\nscript:alert(1)')).toBe(true);
  });

  it('blocks vbscript: URIs', () => {
    expect(_isDangerousUrl('vbscript:msgbox')).toBe(true);
  });

  it('blocks data:text/html URIs', () => {
    expect(_isDangerousUrl('data:text/html,<script>alert(1)</script>')).toBe(true);
  });

  it('allows normal URLs', () => {
    expect(_isDangerousUrl('https://example.com')).toBe(false);
    expect(_isDangerousUrl('/images/photo.jpg')).toBe(false);
  });

  it('allows data:image URIs', () => {
    expect(_isDangerousUrl('data:image/png;base64,abc')).toBe(false);
    expect(_isDangerousUrl('data:image/jpeg;base64,abc')).toBe(false);
  });

  it('blocks non-image data: URIs', () => {
    expect(_isDangerousUrl('data:application/javascript,alert(1)')).toBe(true);
    expect(_isDangerousUrl('data:text/css,body{}')).toBe(true);
  });

  it('blocks data:image/svg+xml URIs', () => {
    expect(_isDangerousUrl('data:image/svg+xml,<svg onload="alert(1)">')).toBe(true);
  });

  it('blocks URLs with null-byte injection', () => {
    expect(_isDangerousUrl('java\x00script:alert(1)')).toBe(true);
  });
});

describe('sanitize', () => {
  it('preserves basic structure', () => {
    const result = sanitize('<p>Hello <strong>world</strong></p>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
    expect(result).toContain('world');
  });

  it('strips disallowed attributes', () => {
    const result = sanitize('<p onclick="alert(1)">text</p>');
    expect(result).not.toContain('onclick');
  });

  it('strips javascript: from href', () => {
    const result = sanitize('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('strips javascript: from src', () => {
    const result = sanitize('<img src="javascript:alert(1)">');
    expect(result).not.toContain('javascript:');
  });

  it('strips dangerous CSS patterns', () => {
    const result = sanitize('<p style="background: expression(alert(1))">text</p>');
    expect(result).not.toContain('style');
  });

  it('strips -moz-binding from style', () => {
    const result = sanitize('<p style="-moz-binding:url(evil)">text</p>');
    expect(result).not.toContain('style');
  });

  it('strips data: URLs in CSS', () => {
    const result = sanitize('<p style="background: url(data:text/html,evil)">text</p>');
    expect(result).not.toContain('style');
  });

  it('preserves allowed attributes', () => {
    const result = sanitize('<a href="https://example.com" target="_blank" rel="noopener">link</a>');
    expect(result).toContain('href');
    expect(result).toContain('target');
    expect(result).toContain('rel');
  });

  it('preserves safe inline styles', () => {
    const result = sanitize('<p style="color: red; font-size: 14px">text</p>');
    expect(result).toContain('style');
  });

  it('preserves data attributes used by Rune', () => {
    const result = sanitize('<div data-rune-block="1" data-id="abc">text</div>');
    expect(result).toContain('data-rune-block');
    expect(result).toContain('data-id');
  });

  it('strips script tags', () => {
    const result = sanitize('<p>safe</p><script>alert(1)</script>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('safe');
  });

  it('strips iframe tags', () => {
    const result = sanitize('<iframe src="https://evil.com"></iframe><p>ok</p>');
    expect(result).not.toContain('<iframe');
    expect(result).toContain('ok');
  });

  it('strips object and embed tags', () => {
    const result = sanitize('<object data="evil.swf"></object><embed src="evil.swf"><p>ok</p>');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('strips form, base, meta, style, link tags', () => {
    const result = sanitize('<form action="/steal"><input></form><base href="/">' +
      '<meta http-equiv="refresh"><style>body{}</style><link rel="stylesheet"><p>ok</p>');
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<base');
    expect(result).not.toContain('<meta');
    expect(result).not.toContain('<style');
    expect(result).not.toContain('<link');
  });

  it('strips svg and math tags', () => {
    const result = sanitize('<svg onload="alert(1)"><circle/></svg><math><mi>x</mi></math><p>ok</p>');
    expect(result).not.toContain('<svg');
    expect(result).not.toContain('<math');
  });

  it('strips nested dangerous tags', () => {
    const result = sanitize('<div><script><script>inner</script></script></div>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('inner');
  });

  it('strips uppercase dangerous tags', () => {
    const result = sanitize('<SCRIPT>alert(1)</SCRIPT><p>ok</p>');
    expect(result).not.toContain('alert');
    expect(result).toContain('ok');
  });
});

describe('normalizeHtml', () => {
  it('wraps bare text in paragraphs', () => {
    const result = normalizeHtml('Hello world');
    expect(result).toBe('<p>Hello world</p>');
  });

  it('preserves existing block elements', () => {
    const result = normalizeHtml('<h1>Title</h1><p>Body</p>');
    expect(result).toContain('<h1>');
    expect(result).toContain('<p>');
  });

  it('wraps inline elements in paragraphs', () => {
    const result = normalizeHtml('<strong>bold</strong>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  it('returns empty paragraph for empty input', () => {
    const result = normalizeHtml('');
    expect(result).toContain('<p>');
  });

  it('handles mixed inline and block content', () => {
    const result = normalizeHtml('text<h1>heading</h1>more text');
    expect(result).toContain('<p>text</p>');
    expect(result).toContain('<h1>heading</h1>');
    expect(result).toContain('<p>more text</p>');
  });
});
