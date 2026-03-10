/**
 * Schema — registry for block types, mark types, formatting, and plugin extensions.
 *
 * Every extension must have:
 *   name      {string}   - unique identifier
 *   type      {string}   - 'block' | 'mark' | 'formatting' | 'plugin'
 *
 * Block extensions also have:
 *   tag       {string}   - HTML tag to create  (e.g. 'p', 'h1', 'ul')
 *   commands  {object}   - { commandName: fn(editor, ...args) }
 *   keymap    {object}   - { 'Mod-b': fn(editor) }
 *   toolbarItem {object} - { icon, title, action, isActive }
 *   slashItem   {object} - { icon, title, description, action }
 *
 * Mark extensions also have:
 *   tag       {string}   - inline tag (e.g. 'strong', 'em')
 *   execCommand {string} - legacy execCommand name (if applicable)
 *
 * Formatting extensions operate on block-level styles (alignment, line height, indent).
 */
export class Schema {
  constructor() {
    this._blocks = new Map();
    this._marks = new Map();
    this._formatting = new Map();
    this._plugins = new Map();
  }

  register(extension) {
    const { name, type } = extension;
    if (!name) throw new Error('[Rune] Extension must have a name.');
    if (!type) throw new Error(`[Rune] Extension "${name}" must have a type.`);

    if (type === 'block') this._blocks.set(name, extension);
    else if (type === 'mark') this._marks.set(name, extension);
    else if (type === 'formatting') this._formatting.set(name, extension);
    else if (type === 'plugin') this._plugins.set(name, extension);
    else throw new Error(`[Rune] Unknown extension type "${type}".`);

    return this;
  }

  getBlock(name) { return this._blocks.get(name); }
  getMark(name) { return this._marks.get(name); }
  getPlugin(name) { return this._plugins.get(name); }

  get blocks() { return [...this._blocks.values()]; }
  get marks() { return [...this._marks.values()]; }
  get formatting() { return [...this._formatting.values()]; }
  get plugins() { return [...this._plugins.values()]; }

  /** Resolve a DOM node to its block extension (by tag + optional match function). */
  resolveBlock(el) {
    if (!el) return null;
    const tag = el.tagName?.toLowerCase();
    let fallback = null;
    for (const block of this._blocks.values()) {
      const tagMatch = Array.isArray(block.tag) ? block.tag.includes(tag) : block.tag === tag;
      if (!tagMatch) continue;
      // Prefer extensions with a specific match function
      if (typeof block.match === 'function') {
        if (block.match(el)) return block;
      } else {
        // First tag-only match as fallback (in case no match() extension claims it)
        if (!fallback) fallback = block;
      }
    }
    return fallback;
  }

  /** Resolve a DOM node to its mark extension (by tag match). */
  resolveMark(el) {
    if (!el) return null;
    const tag = el.tagName?.toLowerCase();
    for (const mark of this._marks.values()) {
      if (mark.tag === tag) return mark;
    }
    return null;
  }

  /** Collect all keymaps from all registered extensions. */
  getKeymap() {
    const map = {};
    for (const ext of [...this._blocks.values(), ...this._marks.values(), ...this._formatting.values(), ...this._plugins.values()]) {
      if (ext.keymap) Object.assign(map, ext.keymap);
    }
    return map;
  }

  /** Collect all toolbar items.
   *  Returns the same object instances on every call so that DOM refs
   *  (_el, _bubbleEl, _toolbarIndicatorEl, _bubbleIndicatorEl) set during
   *  render are visible to _updateActive() and panel callbacks later.
   */
  getToolbarItems() {
    if (!this._toolbarItemsCache) {
      this._toolbarItemsCache = [];
      for (const ext of [...this._blocks.values(), ...this._marks.values(), ...this._formatting.values(), ...this._plugins.values()]) {
        if (ext.toolbarItem) this._toolbarItemsCache.push({ ...ext.toolbarItem, extension: ext });
      }
    }
    return this._toolbarItemsCache;
  }

  /** Collect all slash menu items. */
  getSlashItems() {
    const items = [];
    for (const ext of this._blocks.values()) {
      if (ext.slashItem) items.push({ ...ext.slashItem, extension: ext });
    }
    return items;
  }
}
