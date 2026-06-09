/**
 * Selection — helpers for working with the browser Selection API
 * inside the editor's content area.
 */
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
    const range = document.createRange();
    range.setStart(saved.startContainer, saved.startOffset);
    range.setEnd(saved.endContainer, saved.endOffset);
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

  /** Get the block-level element (direct child of content) at the caret. */
  getBlock() {
    const { content } = this.editor;
    let node = this.getFocusNode();
    while (node && node.parentNode !== content) {
      node = node.parentNode;
    }
    return node && node.nodeType === 1 ? node : null;
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
