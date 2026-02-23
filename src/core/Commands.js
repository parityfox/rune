/**
 * Commands — chainable command system.
 *
 * Usage:
 *   editor.chain().toggleBold().focus().run()
 *   editor.cmd('toggleBold')
 */
export class CommandChain {
  constructor(editor) {
    this.editor = editor;
    this._queue = [];
  }

  /** Queue a command by name with optional arguments. */
  _add(name, args) {
    this._queue.push({ name, args });
    return this;
  }

  /** Execute all queued commands. */
  run() {
    this.editor.history.saveNow();
    let result = true;
    for (const { name, args } of this._queue) {
      result = this.editor._exec(name, ...args);
      if (result === false) break;
    }
    this._queue = [];
    return result;
  }

  // Proxy: dynamically create chained methods from registered commands
  static create(editor) {
    return new Proxy(new CommandChain(editor), {
      get(target, prop) {
        if (prop in target) return target[prop].bind(target);
        // Treat unknown props as command names
        return (...args) => target._add(prop, args);
      }
    });
  }
}

/**
 * CommandRegistry — stores all registered command functions.
 */
export class CommandRegistry {
  constructor() {
    this._cmds = {};
  }

  register(name, fn) {
    this._cmds[name] = fn;
  }

  registerAll(map) {
    Object.entries(map).forEach(([k, v]) => this.register(k, v));
  }

  get(name) {
    return this._cmds[name];
  }

  has(name) {
    return !!this._cmds[name];
  }
}
