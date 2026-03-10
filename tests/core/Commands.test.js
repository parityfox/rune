import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry, CommandChain } from '../../src/core/Commands.js';

describe('CommandRegistry', () => {
  it('registers and retrieves a command', () => {
    const reg = new CommandRegistry();
    const fn = vi.fn();
    reg.register('test', fn);
    expect(reg.get('test')).toBe(fn);
    expect(reg.has('test')).toBe(true);
  });

  it('returns undefined for unknown commands', () => {
    const reg = new CommandRegistry();
    expect(reg.get('nope')).toBeUndefined();
    expect(reg.has('nope')).toBe(false);
  });

  it('registerAll registers multiple commands', () => {
    const reg = new CommandRegistry();
    const a = vi.fn();
    const b = vi.fn();
    reg.registerAll({ a, b });
    expect(reg.get('a')).toBe(a);
    expect(reg.get('b')).toBe(b);
  });

  it('overwrites commands with the same name', () => {
    const reg = new CommandRegistry();
    const first = vi.fn();
    const second = vi.fn();
    reg.register('x', first);
    reg.register('x', second);
    expect(reg.get('x')).toBe(second);
  });
});

describe('CommandChain', () => {
  it('queues and executes a command via run()', () => {
    const fn = vi.fn();
    const editor = {
      history: { saveNow: vi.fn() },
      commands: new CommandRegistry(),
      _exec(name, ...args) {
        const cmd = this.commands.get(name);
        if (cmd) return cmd(...args);
        return false;
      },
    };
    editor.commands.register('doThing', fn);

    const chain = CommandChain.create(editor);
    chain.doThing().run();

    expect(fn).toHaveBeenCalledOnce();
    expect(editor.history.saveNow).toHaveBeenCalledOnce();
  });

  it('stops on false return', () => {
    const fn = vi.fn(() => false);
    const editor = {
      history: { saveNow: vi.fn() },
      commands: new CommandRegistry(),
      _exec(name) {
        const cmd = this.commands.get(name);
        if (cmd) return cmd();
        return false;
      },
    };
    editor.commands.register('fail', fn);

    const chain = CommandChain.create(editor);
    const result = chain.fail().run();

    expect(fn).toHaveBeenCalledOnce();
    expect(result).toBe(false);
  });

  it('passes arguments through', () => {
    const fn = vi.fn();
    const editor = {
      history: { saveNow: vi.fn() },
      commands: new CommandRegistry(),
      _exec(name, ...args) {
        const cmd = this.commands.get(name);
        if (cmd) return cmd(...args);
      },
    };
    editor.commands.register('test', fn);

    CommandChain.create(editor).test(1, 'hello').run();
    expect(fn).toHaveBeenCalledWith(1, 'hello');
  });
});
