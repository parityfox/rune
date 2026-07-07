/**
 * Selection — helpers for working with the browser Selection API
 * inside the editor's content area.
 */
// Content regions of container blocks whose direct children are themselves blocks.
function _isContainerRegion(el) {
  return el?.classList?.contains?.('rune-toggle-body') || el?.classList?.contains?.('rune-column');
}

export class Selection {
  constructor(editor) {
    this.editor = editor;
  }

  get native() {
    return window.getSelection();
  }

  get range() {
    const sel = this.native;
    if (!sel || sel.rangeCount === 0) return null;
    return sel.getRangeAt(0);
  }

  get isCollapsed() {
    const sel = this.native;
    return !sel || sel.isCollapsed;
  }

  get isEmpty() {
    return this.isCollapsed;
  }

  /** Save current range (returns a plain object). */
  save() {
    const range = this.range;
    if (!range) return null;
    return {
      startContainer: range.startContainer,
      startOffset: range.startOffset,
      endContainer: range.endContainer,
      endOffset: range.endOffset,
    };
  }

  /** Restore a saved range. */
  restore(saved) {
    if (!saved) return;
    // The DOM can mutate between save and restore (undo innerHTML swap, text
    // node trim/merge), leaving the saved offsets out of bounds — clamp and
    // guard rather than let setStart throw IndexSizeError at the caller.
    const max = (n) => (n.nodeType === 3 ? n.textContent.length : n.childNodes.length);
    const range = document.createRange();
    try {
      range.setStart(saved.startContainer, Math.min(saved.startOffset, max(saved.startContainer)));
      range.setEnd(saved.endContainer, Math.min(saved.endOffset, max(saved.endContainer)));
    } catch {
      return; // saved nodes no longer form a usable range
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /** Get the deepest focused node inside the editor. */
  getFocusNode() {
    const sel = this.native;
    return sel ? sel.focusNode : null;
  }

  /**
   * The element block-level formatting (indent / outdent / text-align) should
   * target: the nearest list item or table cell at the caret, falling back to
   * the top-level block. Without this, indenting a bullet or centering a cell
   * would mutate the whole <ul>/<table> instead of the item being edited.
   */
  getFormattingTarget() {
    const { content } = this.editor;
    let node = this.getFocusNode();
    while (node && node !== content) {
      if (node.nodeType === 1 && /^(LI|TD|TH)$/.test(node.tagName)) return node;
      node = node.parentNode;
    }
    return this.getBlock();
  }

  /**
   * Get the block-level element at the caret — a direct child of the content
   * root, OR of a container block's content region (toggle body / column), so
   * block commands target the inner block when editing inside a container.
   */
  getBlock() {
    const { content } = this.editor;
    let node = this.getFocusNode();
    while (node && node !== content) {
      const parent = node.parentNode;
      if (parent === content || _isContainerRegion(parent)) {
        return node.nodeType === 1 ? node : null;
      }
      node = parent;
    }
    return null;
  }

  /** Return all block elements that overlap the current selection. */
  getSelectedBlocks() {
    const range = this.range;
    if (!range) return [];
    const { content } = this.editor;
    const blocks = [...content.children];
    return blocks.filter(b => range.intersectsNode(b));
  }

  /** Move caret to end of a given element. */
  setAtEnd(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /** Move caret to start of a given element. */
  setAtStart(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /** Select everything inside an element. */
  selectAll(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /** Check if the caret is at the very start of its block. */
  isAtBlockStart() {
    const range = this.range;
    if (!range || !range.collapsed) return false;
    const block = this.getBlock();
    if (!block) return false;
    const blockRange = document.createRange();
    blockRange.selectNodeContents(block);
    blockRange.collapse(true);
    return range.compareBoundaryPoints(Range.START_TO_START, blockRange) === 0;
  }

  /** Check if the caret is at the very end of its block. */
  isAtBlockEnd() {
    const range = this.range;
    if (!range || !range.collapsed) return false;
    const block = this.getBlock();
    if (!block) return false;
    const blockRange = document.createRange();
    blockRange.selectNodeContents(block);
    blockRange.collapse(false);
    return range.compareBoundaryPoints(Range.END_TO_END, blockRange) === 0;
  }
}
