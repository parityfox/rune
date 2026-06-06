import { _isDangerousUrl } from '../src/utils/html.js';

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
    key: 'link', value: true, tags: ['a'],
    read: (el) => { const h = el.getAttribute('href'); return h && !_isDangerousUrl(h) ? h : null; },
    create: (doc, href) => {
      if (_isDangerousUrl(href)) return null;       // security boundary
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
    if (m.value) { if ((a[m.key] || null) !== (b[m.key] || null)) return false; }
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
};

/** Model type for a top-level block element, or null if not a recognized block. */
export function blockTypeForEl(el) {
  if (el.classList?.contains('rune-image-block')) return 'image';
  const t = el.tagName.toLowerCase();
  if (t === 'p' || t === 'blockquote' || t === 'pre' || /^h[1-6]$/.test(t)) return t;
  return null;
}

export const isPlain = (type) => BLOCKS[type]?.content === 'plain';
export const kindOf = (type) => BLOCKS[type]?.kind || 'text';
