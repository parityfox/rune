/**
 * htmlToMarkdown(html)
 *
 * Converts Rune editor HTML output to Markdown.
 * Custom blocks (callout, task list, table, video) are mapped to their
 * closest Markdown equivalents.
 */
export function htmlToMarkdown(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return _blocks(tmp).trim();
}

// ── Block-level ───────────────────────────────────────────────

function _blocks(container) {
  const parts = [];
  for (const node of container.children) {
    const md = _block(node);
    if (md !== null && md !== '') parts.push(md);
  }
  return parts.join('\n\n');
}

function _block(node) {
  const tag = node.tagName.toLowerCase();

  if (tag === 'h1') return `# ${_inline(node)}`;
  if (tag === 'h2') return `## ${_inline(node)}`;
  if (tag === 'h3') return `### ${_inline(node)}`;

  if (tag === 'p') return _inline(node);

  if (tag === 'hr') return '---';

  if (tag === 'pre') {
    const code = node.querySelector('code');
    const lang = code?.className?.match(/language-(\w+)/)?.[1] ?? '';
    return '```' + lang + '\n' + (code?.textContent ?? node.textContent) + '\n```';
  }

  if (tag === 'blockquote') {
    return node.innerText.trim().split('\n').map(l => `> ${l}`).join('\n');
  }

  // Task list (ul[data-type=tasklist] or ul.rune-task-list)
  if (tag === 'ul' && node.classList.contains('rune-task-list')) {
    return [...node.querySelectorAll('li.rune-task-item')]
      .map(li => {
        const checked = li.dataset.checked === 'true';
        const text = li.querySelector('.rune-task-content')?.textContent ?? _inline(li);
        return `- [${checked ? 'x' : ' '}] ${text}`;
      }).join('\n');
  }

  if (tag === 'ul') {
    return [...node.querySelectorAll(':scope > li')]
      .map(li => `- ${_inline(li)}`).join('\n');
  }

  if (tag === 'ol') {
    return [...node.querySelectorAll(':scope > li')]
      .map((li, i) => `${i + 1}. ${_inline(li)}`).join('\n');
  }

  // Callout → blockquote with emoji prefix
  if (tag === 'div' && node.dataset.type === 'callout') {
    const emoji = node.querySelector('.rune-callout-icon')?.textContent ?? '';
    const body  = node.querySelector('.rune-callout-body');
    const text  = body ? _inline(body) : _inline(node);
    return `> ${emoji} ${text}`;
  }

  // Image
  if (tag === 'figure' && node.classList.contains('rune-image-block')) {
    const img = node.querySelector('img');
    const cap = node.querySelector('figcaption')?.textContent?.trim() ?? '';
    const alt = img?.getAttribute('alt') || cap;
    const src = img?.getAttribute('src') ?? '';
    return `![${_escapeLinkText(alt)}](${_mdUrl(src)})${cap ? `\n*${cap}*` : ''}`;
  }

  // Video embed
  if (tag === 'figure' && node.classList.contains('rune-video-block')) {
    const iframe = node.querySelector('iframe');
    const cap    = node.querySelector('figcaption')?.textContent?.trim() ?? '';
    return `[${_escapeLinkText(cap || 'Video')}](${_mdUrl(iframe?.getAttribute('src') ?? '')})`;
  }

  if (tag === 'table') return _table(node);

  // Fallback: treat as paragraph
  return _inline(node);
}

// ── Inline ────────────────────────────────────────────────────

// Escape Markdown-significant brackets so link/image text can't break the
// surrounding [text](url) / ![alt](src) syntax.
function _escapeLinkText(s) {
  return String(s).replace(/[\[\]]/g, '\\$&');
}

// URLs containing spaces or parentheses break the (url) form; wrap those in
// angle brackets (CommonMark allows <…> destinations) so they survive.
function _mdUrl(url) {
  const u = String(url || '');
  return /[\s()]/.test(u) ? `<${u}>` : u;
}

function _inline(node) {
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent;
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const t = child.tagName.toLowerCase();
    if (t === 'br')                    { out += '\n'; continue; }
    if (t === 'strong' || t === 'b')   { out += `**${_inline(child)}**`; continue; }
    if (t === 'em'     || t === 'i')   { out += `*${_inline(child)}*`;   continue; }
    if (t === 's')                     { out += `~~${_inline(child)}~~`; continue; }
    if (t === 'code')                  { out += `\`${child.textContent}\``; continue; }
    if (t === 'a')                     { out += `[${_escapeLinkText(_inline(child))}](${_mdUrl(child.getAttribute('href') || '')})`; continue; }
    if (t === 'u')                     { out += `<u>${_inline(child)}</u>`; continue; }
    if (t === 'sup')                   { out += `<sup>${_inline(child)}</sup>`; continue; }
    if (t === 'sub')                   { out += `<sub>${_inline(child)}</sub>`; continue; }
    // span (color, size, font) — emit text only, formatting lost in plain MD
    out += _inline(child);
  }
  return out;
}

// ── Table ─────────────────────────────────────────────────────

function _table(table) {
  const rows = [...table.querySelectorAll('tr')];
  if (!rows.length) return '';

  const toRow = cells =>
    '| ' + cells.map(c => c.textContent.trim().replace(/\|/g, '\\|')).join(' | ') + ' |';

  const headerCells = [...rows[0].querySelectorAll('th, td')];
  const separator   = '| ' + headerCells.map(() => '---').join(' | ') + ' |';

  const lines = [toRow(headerCells), separator];
  for (const row of rows.slice(1)) {
    lines.push(toRow([...row.querySelectorAll('td, th')]));
  }
  return lines.join('\n');
}
