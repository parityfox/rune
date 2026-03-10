/**
 * HTML serialization / sanitization utilities.
 */

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'ul', 'ol', 'li', 'div', 'hr',
  'table', 'figure']);

/**
 * Sanitize pasted HTML — keep structure but strip dangerous attrs.
 */
export function sanitize(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  _cleanNode(div);
  return div.innerHTML;
}

const DANGEROUS_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'form',
  'base', 'meta', 'style', 'link', 'noscript',
  'svg', 'math',
]);

function _cleanNode(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      // Remove entire subtree — intentionally drops child content (e.g. script body text)
      if (DANGEROUS_TAGS.has(child.tagName.toLowerCase())) {
        child.remove();
        continue;
      }
      _stripAttrs(child);
      _cleanNode(child);
    }
  }
}

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'src', 'alt', 'class',
  'data-rune-block', 'data-rune-type', 'data-id', 'data-type', 'data-checked',
  'style', 'colspan', 'rowspan']);

function _stripAttrs(el) {
  const toRemove = [];
  for (const attr of el.attributes) {
    if (!ALLOWED_ATTRS.has(attr.name)) {
      toRemove.push(attr.name);
    }
  }
  toRemove.forEach(a => el.removeAttribute(a));

  // Reject javascript: and data: URIs in href / src
  for (const attr of ['href', 'src']) {
    const val = el.getAttribute(attr);
    if (val && _isDangerousUrl(val)) el.removeAttribute(attr);
  }

  // Strip dangerous patterns from inline style
  const style = el.getAttribute('style');
  if (style && _isDangerousStyle(style)) el.removeAttribute('style');
}

function _isDangerousStyle(css) {
  const normalized = css.toLowerCase().replace(/\s/g, '');
  return normalized.includes('javascript:') ||
    normalized.includes('expression(') ||
    normalized.includes('-moz-binding') ||
    // Block url() with data: or remote http(s): — prevents tracking pixels via pasted CSS
    (normalized.includes('url(') && (
      /url\(["']?data:/i.test(normalized) ||
      /url\(["']?https?:\/\//i.test(normalized)
    ));
}

export function _isDangerousUrl(url) {
  // Strip whitespace and null bytes that can be used to bypass checks
  const stripped = url.replace(/[\s\u0000-\u001F]/g, '').toLowerCase();
  return stripped.startsWith('javascript:') ||
    stripped.startsWith('vbscript:') ||
    (stripped.startsWith('data:') && !stripped.startsWith('data:image/')) ||
    stripped.startsWith('data:image/svg');
}

/**
 * Normalise raw HTML before setting it as editor content.
 * Wraps bare text nodes and inline-only content in <p> tags.
 */
export function normalizeHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '<p></p>';

  const children = [...div.childNodes];
  let wrapped = [];
  let inlineBuffer = [];

  const flushInline = () => {
    if (inlineBuffer.length === 0) return;
    const p = document.createElement('p');
    inlineBuffer.forEach(n => p.appendChild(n));
    wrapped.push(p);
    inlineBuffer = [];
  };

  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim()) inlineBuffer.push(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (BLOCK_TAGS.has(tag)) {
        flushInline();
        wrapped.push(node);
      } else {
        inlineBuffer.push(node);
      }
    }
  }
  flushInline();

  if (wrapped.length === 0) {
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    wrapped.push(p);
  }

  return wrapped.map(n => n.outerHTML).join('');
}
