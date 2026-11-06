/**
 * Remove one inline style from the selected text only. Spans inside the selection
 * lose the style, and a styled span around it is split so the unselected text
 * keeps it. Other marks (bold, links…) are left alone.
 *
 * @param {Selection} sel  a non-collapsed selection
 * @param {string[]}  props camelCase style properties, e.g. ['color']
 */
export function clearSelectedStyle(sel, props) {
  const range = sel.getRangeAt(0);
  const isStyled = (n) => n.nodeType === 1 && n.tagName === 'SPAN' && props.some((p) => n.style[p]);

  const anchor = range.commonAncestorContainer;
  const inner = anchor.nodeType === 1 ? anchor : anchor.parentElement;
  let wrapper = inner;
  while (wrapper && !isStyled(wrapper)) wrapper = wrapper.parentElement;

  // Marks where the selection ends, to split the wrapper there after extraction.
  let endMark = null;
  if (wrapper) {
    const end = range.cloneRange();
    end.collapse(false);
    endMark = document.createComment('');
    end.insertNode(endMark);
  }

  const frag = range.extractContents();
  for (const span of [...frag.querySelectorAll('span')]) _strip(span, props);

  let nodes = [...frag.childNodes];
  if (wrapper) {
    // Marks between the selection and the styled span were not extracted with it.
    let piece = frag;
    for (let n = inner; n !== wrapper; n = n.parentElement) {
      const copy = n.cloneNode(false);
      copy.appendChild(piece);
      piece = copy;
    }
    // The selected text keeps whatever else the wrapper styled.
    const rest = wrapper.cloneNode(false);
    _clear(rest, props);
    if (_hasStyle(rest)) {
      rest.appendChild(piece);
      piece = rest;
    }
    if (piece !== frag) nodes = [piece];
    const tailRange = document.createRange();
    tailRange.setStartAfter(endMark);
    tailRange.setEndAfter(wrapper);
    const tail = tailRange.extractContents();
    endMark.remove();
    wrapper.after(piece, ...(tail.textContent ? [tail] : []));
    if (!wrapper.textContent) wrapper.remove();
  } else {
    range.insertNode(frag);
  }

  if (nodes.length) {
    const next = document.createRange();
    next.setStartBefore(nodes[0]);
    next.setEndAfter(nodes[nodes.length - 1]);
    sel.removeAllRanges();
    sel.addRange(next);
  }
}

function _clear(span, props) {
  for (const p of props) span.style[p] = '';
}

function _hasStyle(span) {
  return !!span.getAttribute('style')?.trim();
}

function _strip(span, props) {
  if (!props.some((p) => span.style[p])) return;
  _clear(span, props);
  if (!_hasStyle(span)) span.replaceWith(...span.childNodes);
}
