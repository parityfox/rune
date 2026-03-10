import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';

describe('EventBus', () => {
  it('calls listeners on emit', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('test', fn);
    bus.emit('test', 'a', 'b');
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });

  it('supports multiple listeners', () => {
    const bus = new EventBus();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on('x', fn1);
    bus.on('x', fn2);
    bus.emit('x');
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('once listeners fire only once', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.once('x', fn);
    bus.emit('x');
    bus.emit('x');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('off removes a specific listener', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('x', fn);
    bus.off('x', fn);
    bus.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears a specific event', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('a', fn);
    bus.on('b', fn);
    bus.removeAllListeners('a');
    bus.emit('a');
    bus.emit('b');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('removeAllListeners with no arg clears everything', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('a', fn);
    bus.on('b', fn);
    bus.removeAllListeners();
    bus.emit('a');
    bus.emit('b');
    expect(fn).not.toHaveBeenCalled();
  });

  it('methods are chainable', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const result = bus.on('x', fn).emit('x').off('x', fn).removeAllListeners();
    expect(result).toBe(bus);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('emitting unknown event does not throw', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });
});
