import { _isDangerousUrl, _isAllowedHref, _safeColor } from '../src/utils/html.js';

/**
 * Central collab schema (#10) — the declarative DOM <-> Yjs mapping the binding
 * consumes. Adding a mark or a block type is a data change here, not edits
 * scattered through the binding.
 *
 * MARKS are listed in render-precedence order (outermost first). Boolean marks
 * carry `true`; value marks (link) carry a string. BLOCKS map a tag to a model
 * `type` and declare whether their content is `inline` (marks) or `plain`.
 */

export const MARKS = [
  {
    // Tracked-change mark (#15). Object-valued: { id, type:'insert'|'delete', author, color? }.
    // Outermost so the whole run is visibly tracked. Detected on <span data-suggestion>.
    // Per-author color (#21): type is conveyed by the DECORATION (underline vs
    // strikethrough) so color is never the only signal; author by `color`.
    key: 'suggestion', value: true, object: true, tags: ['span'],
    read: (el) => { const d = el.getAttribute('data-suggestion'); return d ? JSON.parse(d) : null; },
    create: (doc, sug) => {
      const s = doc.createElement('span');
      const type = sug.type === 'delete' ? 'delete' : 'insert';
      s.className = 'rune-suggestion rune-suggestion--' + type;
      s.setAttribute('data-suggestion', JSON.stringify(sug));
      if (sug.author) s.setAttribute('title', `${type === 'delete' ? 'Deletion' : 'Insertion'} by ${sug.author}`);
      if (sug.color) {                                   // author color overrides the CSS default
        // Peer-controlled — launder so a url() beacon / declaration breakout
        // can't ride the color into every peer's DOM (text-decoration-color in
        // particular accepts url()).
        const color = _safeColor(sug.color);
        s.style.color = color;
        if (type === 'insert') { s.style.textDecoration = 'underline'; s.style.textDecorationColor = color; }
        else { s.style.textDecoration = 'line-through'; }
      }
      return s;
    },
  },
  {
    key: 'link', value: true, tags: ['a'],
    read: (el) => { const h = el.getAttribute('href'); return h && _isAllowedHref(h) ? h : null; },
    create: (doc, href) => {
      if (!_isAllowedHref(href)) return null;       // security boundary (scheme allowlist)
      const a = doc.createElement('a');
      a.setAttribute('href', href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      return a;
    },
  },
  { key: 'bold',      tags: ['strong', 'b'],        create: (doc) => doc.createElement('strong') },
  { key: 'italic',    tags: ['em', 'i'],            create: (doc) => doc.createElement('em') },
  { key: 'underline', tags: ['u'],                  create: (doc) => doc.createElement('u') },
  { key: 'strike',    tags: ['s', 'strike', 'del'], create: (doc) => doc.createElement('s') },
  { key: 'code',      tags: ['code'],               create: (doc) => doc.createElement('code') },
];

const TAG_TO_MARK = {};
for (const m of MARKS) for (const t of m.tags) TAG_TO_MARK[t] = m;

/** Mark spec for an inline tag, or null. */
export const markForTag = (tag) => TAG_TO_MARK[tag] || null;

/** Compare two attribute sets across all marks. */
export function sameAttrs(a = {}, b = {}) {
  for (const m of MARKS) {
    if (m.object) { if (JSON.stringify(a[m.key] ?? null) !== JSON.stringify(b[m.key] ?? null)) return false; }
    else if (m.value) { if ((a[m.key] || null) !== (b[m.key] || null)) return false; }
    else if (!!a[m.key] !== !!b[m.key]) return false;
  }
  return true;
}

// kind: 'text' (default — has a Y.Text, inline|plain) | 'atomic' (no text;
// stored as a `data` object, rendered from it).
export const BLOCKS = {
  p:          { tag: 'p',          kind: 'text', content: 'inline' },
  h1: { tag: 'h1', kind: 'text', content: 'inline' }, h2: { tag: 'h2', kind: 'text', content: 'inline' }, h3: { tag: 'h3', kind: 'text', content: 'inline' },
  h4: { tag: 'h4', kind: 'text', content: 'inline' }, h5: { tag: 'h5', kind: 'text', content: 'inline' }, h6: { tag: 'h6', kind: 'text', content: 'inline' },
  blockquote: { tag: 'blockquote', kind: 'text', content: 'inline' },
  li:         { tag: 'li',         kind: 'text', content: 'inline', list: true },
  pre:        { tag: 'pre',        kind: 'text', content: 'plain' },   // code block: plain text, no marks
  // Table cell (#18): each <td>/<th> is its own text block, grouped back into a
  // <table> on render — so cells edit concurrently like any paragraph.
  cell:       { tag: 'td',         kind: 'text', content: 'inline' },

  // Atomic (void) — no editable text; model holds a `data` object.
  image: {
    tag: 'figure', kind: 'atomic',
    read: (el) => {
      const img = el.querySelector('img');
      return { src: img?.getAttribute('src') || '', alt: img?.getAttribute('alt') || '' };
    },
    create: (doc, data = {}) => {
      const fig = doc.createElement('figure');
      fig.className = 'rune-image-block';
      const img = doc.createElement('img');
      if (data.src && !_isDangerousUrl(data.src)) img.setAttribute('src', data.src);  // security boundary
      if (data.alt) img.setAttribute('alt', data.alt);
      img.setAttribute('contenteditable', 'false');
      fig.appendChild(img);
      return fig;
    },
  },

  // Wrapped (#18) — a decorated block whose editable region is a sub-element.
  // Model: a Y.Text (the body's inline content, with marks) + emoji/color attrs,
  // so the callout body supports concurrent editing like any paragraph.
  callout: {
    tag: 'div', kind: 'wrapped',
    body: (el) => el.querySelector('.rune-callout-body') || el,
    readMeta: (el) => ({
      emoji: el.querySelector('.rune-callout-icon')?.textContent || '💡',
      color: (el.className.match(/rune-callout--([\w-]+)/) || [])[1] || 'gray',
    }),
    createWrapper: (doc, meta = {}) => {
      const div = doc.createElement('div');
      div.className = `rune-callout rune-callout--${meta.color || 'gray'}`;
      div.setAttribute('data-type', 'callout');
      const icon = doc.createElement('span');
      icon.className = 'rune-callout-icon';
      icon.setAttribute('contenteditable', 'false');
      icon.textContent = meta.emoji || '💡';
      const body = doc.createElement('div');
      body.className = 'rune-callout-body';
      div.append(icon, body);
      return { wrapper: div, body };
    },
    applyMeta: (el, meta = {}) => {                       // update icon/color on a reused wrapper
      const icon = el.querySelector('.rune-callout-icon');
      const emoji = meta.emoji || '💡';
      if (icon && icon.textContent !== emoji) icon.textContent = emoji;
      const want = `rune-callout rune-callout--${meta.color || 'gray'}`;
      if (el.className !== want) el.className = want;
    },
  },
};

/** Model type for a top-level block element, or null. (Tables are expanded into
 *  `cell` blocks by flattenHosts, so <table> is not a single block type here.) */
export function blockTypeForEl(el) {
  if (el.classList?.contains('rune-image-block')) return 'image';
  if (el.classList?.contains('rune-callout')) return 'callout';
  const t = el.tagName.toLowerCase();
  if (t === 'p' || t === 'blockquote' || t === 'pre' || /^h[1-6]$/.test(t)) return t;
  return null;
}

export const isPlain = (type) => BLOCKS[type]?.content === 'plain';
export const kindOf = (type) => BLOCKS[type]?.kind || 'text';
