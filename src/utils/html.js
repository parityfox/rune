/**
 * HTML serialization / sanitization utilities.
 */

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'ul', 'ol', 'li', 'div', 'hr',
  'table', 'figure']);

/**
 * Sanitize pasted HTML — strict profile. Strips all dangerous tags/attrs,
 * including iframes. Use for untrusted external input (clipboard).
 */
export function sanitize(html) {
  return _sanitize(html, { embeds: false, contentAttrs: false });
}

/**
 * Sanitize HTML loaded as editor content (setHtml / initial content). Same
 * safety guarantees as sanitize(), but preserves the editor's own rich blocks:
 * sandboxed YouTube/Vimeo embeds and structural attributes (contenteditable,
 * data-*, embed attrs) so a getHtml() -> setHtml() round-trip is lossless.
 */
export function sanitizeContent(html) {
  return _sanitize(html, { embeds: true, contentAttrs: true });
}

function _sanitize(html, opts) {
  const div = document.createElement('div');
  div.innerHTML = html;
  _cleanNode(div, opts);
  return div.innerHTML;
}

const DANGEROUS_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'form',
  'base', 'meta', 'style', 'link', 'noscript',
  'svg', 'math',
  // <template> children live in a DocumentFragment (template.content), not in
  // childNodes, so the recursive cleaner can't reach them — remove it outright.
  'template',
]);

// Only https YouTube/Vimeo embed URLs may live in an <iframe> (content profile).
const SAFE_EMBED_RE = /^https:\/\/(www\.youtube\.com\/embed\/[\w-]+|player\.vimeo\.com\/video\/\d+)(?:[/?]|$)/;

function _cleanNode(node, opts) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = child.tagName.toLowerCase();
    if (DANGEROUS_TAGS.has(tag)) {
      // Content profile: keep a sandboxed iframe pointing at a known embed host.
      if (opts.embeds && tag === 'iframe' &&
          SAFE_EMBED_RE.test((child.getAttribute('src') || '').trim())) {
        _stripAttrs(child, opts);
        // Force the sandbox (overwriting any attacker-supplied one). allow-scripts
        // + allow-same-origin is the usual "can drop its own sandbox" footgun ONLY
        // when the frame is same-origin to this page; SAFE_EMBED_RE pins src to
        // cross-origin YouTube/Vimeo, so their script can't reach frameElement.
        // allow-same-origin stays because those players need their own origin's
        // storage to load — dropping it breaks playback for no security gain.
        child.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        _cleanNode(child, opts);
        continue;
      }
      // Remove entire subtree — intentionally drops child content (e.g. script body text)
      child.remove();
      continue;
    }
    _stripAttrs(child, opts);
    _cleanNode(child, opts);
  }
}

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'src', 'alt', 'class',
  'data-rune-block', 'data-rune-type', 'data-id', 'data-type', 'data-checked',
  'style', 'colspan', 'rowspan']);

// Extra attributes kept only for trusted editor content (embeds, captions,
// checkboxes). None can execute script.
const CONTENT_ATTRS = new Set(['contenteditable', 'data-placeholder',
  'frameborder', 'allowfullscreen', 'allow', 'sandbox',
  // a11y attributes on the editor's own controls (e.g. task checkboxes) — none
  // can execute script, and preserving them keeps a getHtml()->setHtml() round
  // trip accessible.
  'role', 'tabindex', 'aria-checked', 'aria-label']);
const CONTENT_ALLOWED = new Set([...ALLOWED_ATTRS, ...CONTENT_ATTRS]);

function _stripAttrs(el, opts) {
  const allowed = opts.contentAttrs ? CONTENT_ALLOWED : ALLOWED_ATTRS;
  const toRemove = [];
  for (const attr of el.attributes) {
    if (!allowed.has(attr.name)) {
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

  // Prevent reverse tabnabbing on links that open a new browsing context.
  if (el.tagName === 'A' && (el.getAttribute('target') || '').toLowerCase() === '_blank') {
    el.setAttribute('rel', 'noopener noreferrer');
  }
}

function _isDangerousStyle(css) {
  const normalized = css.toLowerCase().replace(/\s/g, '');
  return normalized.includes('javascript:') ||
    normalized.includes('expression(') ||
    normalized.includes('-moz-binding') ||
    // Block any url() in inline styles — the editor never needs it, and this
    // prevents tracking pixels plus CSS hex-escape bypasses (e.g. url(\\64 ata:)).
    normalized.includes('url(');
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
 * Positive scheme allowlist for link hrefs. _isDangerousUrl is a denylist tuned
 * for <img src> (it permits data:image/* etc.), which is wrong for a hyperlink.
 * Here anything with an explicit scheme must be http/https/mailto/tel; schemeless
 * values (relative paths, root-relative, #anchors, ?query) are allowed. Control
 * chars are stripped first so "java\tscript:" can't masquerade as schemeless.
 */
export function _isAllowedHref(url) {
  const stripped = String(url == null ? '' : url).replace(/[\s\u0000-\u001F]/g, '');
  if (!stripped) return false;
  if (/^[#/?]/.test(stripped) || /^\.{1,2}\//.test(stripped)) return true;   // fragment / path
  const m = stripped.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!m) return true;                                                        // schemeless -> relative
  return ['http', 'https', 'mailto', 'tel'].includes(m[1].toLowerCase());
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
