/**
 * EventBus — a simple pub/sub event system.
 *
 * Usage:
 *   bus.on('change', handler)
 *   bus.once('change', handler)
 *   bus.off('change', handler)
 *   bus.emit('change', data)
 */
export class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push({ fn, once: false });
    return this;
  }

  once(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push({ fn, once: true });
    return this;
  }

  off(event, fn) {
    if (!this._listeners[event]) return this;
    this._listeners[event] = this._listeners[event].filter(l => l.fn !== fn);
    return this;
  }

  emit(event, ...args) {
    const listeners = this._listeners[event] || [];
    const remaining = [];
    for (const listener of listeners) {
      listener.fn(...args);
      if (!listener.once) remaining.push(listener);
    }
    this._listeners[event] = remaining;
    return this;
  }

  removeAllListeners(event) {
    if (event) delete this._listeners[event];
    else this._listeners = {};
    return this;
  }
}
