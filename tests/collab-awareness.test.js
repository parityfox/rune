import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { MemoryHub } from '../collab/memory-hub.js';

// #12: presence rides ephemeral Awareness relayed by the hub (not the doc).

describe('MemoryHub awareness relay', () => {
  it('relays local presence to other peers', () => {
    const hub = new MemoryHub();
    const dA = new Y.Doc(), dB = new Y.Doc();
    const aA = new Awareness(dA), aB = new Awareness(dB);
    hub.connect(dA, aA);
    hub.connect(dB, aB);

    aA.setLocalStateField('user', { name: 'Alice', color: '#00f' });
    aA.setLocalStateField('cursor', { block: 'blk1', rel: { type: null, tname: null, item: null, assoc: 0 } });

    const seen = aB.getStates().get(dA.clientID);
    expect(seen?.user?.name).toBe('Alice');
    expect(seen?.cursor?.block).toBe('blk1');

    aA.destroy(); aB.destroy();
  });

  it('removes presence when a peer clears its local state', () => {
    const hub = new MemoryHub();
    const dA = new Y.Doc(), dB = new Y.Doc();
    const aA = new Awareness(dA), aB = new Awareness(dB);
    hub.connect(dA, aA);
    hub.connect(dB, aB);

    aA.setLocalStateField('user', { name: 'Alice' });
    expect(aB.getStates().has(dA.clientID)).toBe(true);

    aA.setLocalState(null);
    expect(aB.getStates().has(dA.clientID)).toBe(false);

    aA.destroy(); aB.destroy();
  });

  it('does not relay awareness while paused, resyncs on resume', () => {
    const hub = new MemoryHub();
    const dA = new Y.Doc(), dB = new Y.Doc();
    const aA = new Awareness(dA), aB = new Awareness(dB);
    hub.connect(dA, aA);
    hub.connect(dB, aB);

    hub.pause();
    aA.setLocalStateField('user', { name: 'Alice' });
    expect(aB.getStates().get(dA.clientID)?.user?.name).toBeUndefined();   // held while offline

    hub.resume();
    expect(aB.getStates().get(dA.clientID)?.user?.name).toBe('Alice');     // resynced on reconnect

    aA.destroy(); aB.destroy();
  });
});
