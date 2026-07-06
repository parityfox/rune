/**
 * JSON document model — a portable, ProseMirror-style node tree:
 *   { type:'doc', content: Node[] }
 *   Node (block):  { type, attrs?, content?: Inline[] | Node[] }
 *   Inline:        { type:'text', text, marks?: [{ type, attrs? }] } | { type:'hardBreak' }
 *
 * `htmlToJson(html)` parses HTML (needs a DOM); `jsonToHtml(doc)` renders a doc
 * to an HTML string with NO DOM, so it runs server-side. Text and attribute
 * values are HTML-escaped (quotes included) and link hrefs with dangerous
 * schemes are dropped, so structured nodes are safe to render directly.
 *
 * NOTE: the { type:'html', html } passthrough (used so callout/table/image/
 * toggle/columns round-trip losslessly) is emitted verbatim. In the normal
 * getJSON()->setJSON() round-trip that HTML originated from the editor's own
 * sanitized content; if you build docs by hand, treat passthrough html as
 * trusted input — jsonToHtml cannot sanitize it without a DOM.
 */
import { _isDangerousUrl } from './html.js';

const INLINE_MARK = {
  STRONG: 'bold', B: 'bold', EM: 'italic', I: 'italic', U: 'underline',
  S: 'strike', STRIKE: 'strike', DEL: 'strike', CODE: 'code', A: 'link',
  SUP: 'superscript', SUB: 'subscript', MARK: 'highlight',
};

const MARK_WRAP = {
  bold: ['<strong>', '</strong>'], italic: ['<em>', '</em>'], underline: ['<u>', '</u>'],
  strike: ['<s>', '</s>'], code: ['<code>', '</code>'], superscript: ['<sup>', '</sup>'],
  subscript: ['<sub>', '</sub>'], highlight: ['<mark>', '</mark>'],
};

// ── HTML → JSON (DOM) ─────────────────────────────────────────
export function htmlToJson(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return { type: 'doc', content: [...div.children].map(_blockToJson).filter(Boolean) };
}

function _listItems(el) {
  return [...el.querySelectorAll(':scope > li')].map((li) => ({ type: 'listItem', content: _inlineToJson(li) }));
}

function _blockToJson(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'p') return { type: 'paragraph', content: _inlineToJson(el) };
  if (/^h[1-6]$/.test(tag)) return { type: 'heading', attrs: { level: +tag[1] }, content: _inlineToJson(el) };
  if (tag === 'blockquote') return { type: 'blockquote', content: _inlineToJson(el) };
  if (tag === 'hr') return { type: 'horizontalRule' };
  if (tag === 'pre') {
    const code = el.querySelector('code');
    const lang = code?.className?.match(/language-(\w+)/)?.[1] || null;
    return { type: 'codeBlock', attrs: lang ? { language: lang } : {}, content: [{ type: 'text', text: (code || el).textContent }] };
  }
  if (tag === 'ul' && !el.classList.contains('rune-task-list')) return { type: 'bulletList', content: _listItems(el) };
  if (tag === 'ol') return { type: 'orderedList', content: _listItems(el) };
  return { type: 'html', html: el.outerHTML };           // passthrough — nothing lost
}

function _inlineToJson(el) {
  const out = [];
  const walk = (node, marks) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        if (child.textContent) out.push({ type: 'text', text: child.textContent, ...(marks.length ? { marks } : {}) });
        continue;
      }
      if (child.nodeType !== 1) continue;
      if (child.tagName === 'BR') { out.push({ type: 'hardBreak' }); continue; }
      const type = INLINE_MARK[child.tagName];
      if (type) {
        const mark = { type };
        if (type === 'link') mark.attrs = { href: child.getAttribute('href') || '' };
        walk(child, [...marks, mark]);
      } else {
        walk(child, marks);                                // unknown inline wrapper — flatten
      }
    }
  };
  walk(el, []);
  return out;
}

// ── JSON → HTML (no DOM) ──────────────────────────────────────
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function jsonToHtml(doc) {
  if (!doc || !Array.isArray(doc.content)) return '';
  return doc.content.map(_blockToHtml).join('');
}

function _blockToHtml(node) {
  switch (node.type) {
    case 'paragraph':      return `<p>${_inlineToHtml(node.content)}</p>`;
    case 'heading':        { const l = Math.min(6, Math.max(1, node.attrs?.level || 1)); return `<h${l}>${_inlineToHtml(node.content)}</h${l}>`; }
    case 'blockquote':     return `<blockquote>${_inlineToHtml(node.content)}</blockquote>`;
    case 'horizontalRule': return '<hr>';
    case 'codeBlock':      { const lang = node.attrs?.language; const text = (node.content || []).map((n) => n.text || '').join(''); return `<pre><code${lang ? ` class="language-${_esc(lang)}"` : ''}>${_esc(text)}</code></pre>`; }
    case 'bulletList':     return `<ul>${(node.content || []).map((li) => `<li>${_inlineToHtml(li.content)}</li>`).join('')}</ul>`;
    case 'orderedList':    return `<ol>${(node.content || []).map((li) => `<li>${_inlineToHtml(li.content)}</li>`).join('')}</ol>`;
    case 'html':           return node.html || '';
    default:               return '';
  }
}

function _inlineToHtml(content) {
  return (content || []).map((n) => {
    if (n.type === 'hardBreak') return '<br>';
    if (n.type !== 'text') return '';
    let html = _esc(n.text);
    // Apply marks inner→outer so the first mark in the array stays outermost.
    for (const mark of [...(n.marks || [])].reverse()) {
      if (mark.type === 'link') { const href = mark.attrs?.href; html = `<a href="${_isDangerousUrl(String(href ?? '')) ? '' : _esc(href)}">${html}</a>`; }
      else if (MARK_WRAP[mark.type]) html = MARK_WRAP[mark.type][0] + html + MARK_WRAP[mark.type][1];
    }
    return html;
  }).join('');
}
