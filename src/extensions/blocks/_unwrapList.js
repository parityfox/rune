/**
 * Turn a list into paragraphs in place. Only direct items become paragraphs; a
 * nested list stays a list, right after its parent item's paragraph.
 */
export function unwrapList(list) {
  const frag = document.createDocumentFragment();
  for (const li of [...list.children]) {
    if (li.tagName !== 'LI') continue;
    const nested = [...li.children].filter((c) => c.tagName === 'UL' || c.tagName === 'OL');
    nested.forEach((n) => n.remove());
    const p = document.createElement('p');
    p.innerHTML = li.innerHTML.trim() || '<br>';
    frag.append(p, ...nested);
  }
  list.replaceWith(frag);
}
