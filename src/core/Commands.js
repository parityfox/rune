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
      get(target, prop, proxy) {
        if (prop in target) {
          const value = target[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
        // Not commands: `then` would make the chain a thenable that never settles.
        if (typeof prop === 'symbol' || prop === 'then') return undefined;
        // Treat unknown props as command names
        return (...args) => { target._add(prop, args); return proxy; };
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
