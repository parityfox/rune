/**
 * markdownToHtml(md) — a small, dependency-free CommonMark-subset parser.
 *
 * Supports: ATX headings, paragraphs, blockquotes, fenced code, thematic breaks,
 * ordered/unordered lists (with indentation-based nesting), GFM tables, images,
 * links, and inline **bold** *italic* `code` ~~strike~~. It is pure string work
 * (no DOM), so it also runs server-side. Output is safe to render directly:
 * text and attribute values are HTML-escaped (quotes included) and link/image
 * URLs with dangerous schemes (javascript:, non-image data:, …) are dropped.
 * The editor still re-sanitizes on the way in as a second layer.
 */
import { _isDangerousUrl, _isAllowedHref } from './html.js';

// Image src: denylist (legitimately allows data:image/*). Runs on the
// already-HTML-escaped capture, so it also feeds the sanitizer a clean value.
function _safeSrc(url) {
  return _isDangerousUrl(url) ? '' : url;
}

// Link href: positive scheme allowlist (http/https/mailto/tel + relative),
// matching the rest of the codebase — stricter than the img denylist.
function _safeHref(url) {
  return _isAllowedHref(url) ? url : '';
}

export function markdownToHtml(md) {
  const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }                          // blank

    // Fenced code
    const fence = line.match(/^(\s*)(`{3,}|~{3,})\s*([\w-]*)\s*$/);
    if (fence) {
      const marker = fence[2][0];
      const lang = fence[3];
      const code = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(lines[i])) { code.push(lines[i]); i++; }
      i++; // closing fence
      out.push(`<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // ATX heading
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) { const lvl = h[1].length; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); i++; continue; }

    // Thematic break
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // Table  (header row + delimiter row)
    if (/^\s*\|.*\|?\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[-:\s|]*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const { html, next } = parseTable(lines, i);
      if (html) { out.push(html); i = next; continue; }
    }

    // Blockquote (recursive: `>>` nests, inner Markdown is parsed)
    if (/^\s*>\s?/.test(line)) {
      const inner = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { inner.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      let body = markdownToHtml(inner.join('\n'));
      // Keep simple one-paragraph quotes as <blockquote>text</blockquote>.
      const m = body.match(/^<p>([\s\S]*)<\/p>$/);
      if (m && !m[1].includes('<p>') && !m[1].includes('<blockquote>')) body = m[1];
      out.push(`<blockquote>${body}</blockquote>`);
      continue;
    }

    // List
    if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) {
      const { html, next } = parseList(lines, i, 0);
      out.push(html);
      i = next;
      continue;
    }

    // Paragraph — gather consecutive lines until a blank line or a new block
    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines, i)) { para.push(lines[i].trim()); i++; }
    out.push(`<p>${inline(para.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }

  return out.join('');
}

function isBlockStart(lines, i) {
  const l = lines[i];
  return /^(#{1,6})\s/.test(l) ||
         /^\s*>\s?/.test(l) ||
         /^(\s*)(`{3,}|~{3,})/.test(l) ||
         /^(\s*)([-*+]|\d+[.)])\s+/.test(l) ||
         /^\s*([-*_])(\s*\1){2,}\s*$/.test(l) ||
         (/^\s*\|.*\|?\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[-:\s|]*$/.test(lines[i + 1]));
}

function parseList(lines, start, depth) {
  const itemRe = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  const first = lines[start].match(itemRe);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const tag = ordered ? 'ol' : 'ul';
  const items = [];
  let i = start;

  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    const m = lines[i].match(itemRe);
    if (!m) break;
    const indent = m[1].length;
    if (indent < baseIndent) break;                    // dedent — close this list
    if (indent >= baseIndent + 2 && items.length) {    // nested list under the last item
      const nested = parseList(lines, i, depth + 1);
      items[items.length - 1].nested += nested.html;
      i = nested.next;
      continue;
    }
    items.push({ text: m[3], nested: '' });
    i++;
  }

  const body = items.map((it) => `<li>${inline(it.text)}${it.nested}</li>`).join('');
  return { html: `<${tag}>${body}</${tag}>`, next: i };
}

function parseTable(lines, start) {
  const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = cells(lines[start]);
  let i = start + 2;
  const rows = [];
  while (i < lines.length && /^\s*\|.*\|?\s*$/.test(lines[i]) && lines[i].includes('|')) { rows.push(cells(lines[i])); i++; }

  const thead = `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return { html: `<table>${thead}${tbody}</table>`, next: i };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, src) => `<img src="${_safeSrc(src)}" alt="${alt}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, t, url) => `<a href="${_safeHref(url)}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_\s][^_]*?)_/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  return s;
}
