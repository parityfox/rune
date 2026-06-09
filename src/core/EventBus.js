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
    const listeners = this._listeners[event];
    if (!listeners || listeners.length === 0) return this;

    // Iterate a snapshot so a handler that subscribes/unsubscribes mid-emit
    // can't corrupt the loop, and isolate each handler so one that throws can't
    // suppress the rest or break once() cleanup.
    const snapshot = listeners.slice();
    for (const listener of snapshot) {
      try {
        listener.fn(...args);
      } catch (err) {
        console.error(`[Rune] "${event}" listener threw:`, err);
      }
    }

    // Drop the once-listeners that just fired, preserving any on()/off() done
    // during emit (rebuild from the current list, not the snapshot).
    const fired = snapshot.filter(l => l.once);
    if (fired.length && this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(l => !fired.includes(l));
    }
    return this;
  }

  removeAllListeners(event) {
    if (event) delete this._listeners[event];
    else this._listeners = {};
    return this;
  }
}
