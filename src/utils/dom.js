/**
 * Lightweight DOM utility helpers used throughout the editor.
 */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

export function closest(node, selector) {
  while (node && node !== document) {
    if (node.matches && node.matches(selector)) return node;
    node = node.parentNode;
  }
  return null;
}

export function isInside(node, container) {
  return container.contains(node);
}

export function getBlockElement(node, contentEl) {
  let cur = node;
  while (cur && cur.parentNode !== contentEl) {
    cur = cur.parentNode;
  }
  return cur && cur.nodeType === 1 ? cur : null;
}

export function removeAllChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function getCaretRect() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  return rects.length ? rects[0] : null;
}

export function getSelectionRect() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  return sel.getRangeAt(0).getBoundingClientRect();
}
