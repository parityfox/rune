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

function _cleanNode(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      _stripAttrs(child);
      _cleanNode(child);
    }
  }
}

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'src', 'alt', 'class',
  'data-rune-block', 'data-rune-type', 'data-id', 'data-type', 'data-checked',
  'frameborder', 'allowfullscreen', 'style', 'colspan', 'rowspan']);

function _stripAttrs(el) {
  const toRemove = [];
  for (const attr of el.attributes) {
    if (!ALLOWED_ATTRS.has(attr.name)) toRemove.push(attr.name);
  }
  toRemove.forEach(a => el.removeAttribute(a));
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
