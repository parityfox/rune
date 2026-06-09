import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { MemoryHub } from '../collab/memory-hub.js';
import { bindPresence } from '../collab/presence.js';
import { bindParagraph } from '../collab/paragraph-binding.js';
import { PresenceBar } from '../src/ui/PresenceBar.js';
import { Editor } from '../src/core/Editor.js';
import { Paragraph } from '../src/extensions/blocks/Paragraph.js';

describe('presence roster API + bar (#91)', () => {
  let hub, edA, edB, docA, docB, awA, awB, pA, pB, tA, tB;

  beforeEach(() => {
    tA = document.createElement('div'); document.body.appendChild(tA);
    tB = document.createElement('div'); document.body.appendChild(tB);
    hub = new MemoryHub();
    docA = new Y.Doc(); docB = new Y.Doc();
    awA = new Awareness(docA); awB = new Awareness(docB);
    hub.connect(docA, awA); hub.connect(docB, awB);
    edA = new Editor(tA, { extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false, content: '<p>hi</p>' });
    edB = new Editor(tB, { extensions: [Paragraph], toolbar: false, bubbleMenu: false, slashMenu: false, content: '' });
    bindParagraph(edA, docA); bindParagraph(edB, docB);
    pA = bindPresence(edA, docA, awA, { name: 'Ada', color: '#f00' });
    pB = bindPresence(edB, docB, awB, { name: 'Bob', color: '#00f', avatar: '🅱' });
  });
  afterEach(() => {
    pA?.destroy(); pB?.destroy(); edA?.destroy(); edB?.destroy(); tA.remove(); tB.remove();
  });

  it('roster includes both users with name/color/avatar/state', () => {
    const users = pA.getUsers();
    expect(users.find((u) => u.isSelf)?.name).toBe('Ada');
    const bob = users.find((u) => u.name === 'Bob');
    expect(bob).toBeTruthy();
    expect(bob.color).toBe('#00f');
    expect(bob.avatar).toBe('🅱');
    expect(['active', 'idle', 'away']).toContain(bob.state);
  });

  it('emits change on roster updates; follow/unfollow are safe', () => {
    let fired = 0;
    const unsub = pA.on('change', () => { fired++; });
    pB.setUser({ name: 'Bobby' });
    expect(fired).toBeGreaterThan(0);
    const bobId = pA.getUsers().find((u) => !u.isSelf)?.id;
    expect(() => { pA.follow(bobId); pA.unfollow(); }).not.toThrow();
    unsub();
  });

  it('PresenceBar renders one avatar per remote user with click-to-follow', () => {
    const container = document.createElement('div');
    const bar = new PresenceBar(pA, container);
    let avatars = container.querySelectorAll('.rune-presence-avatar');
    expect(avatars.length).toBe(1);            // self excluded
    expect(avatars[0].textContent).toBe('🅱');

    avatars[0].click();
    expect(container.querySelector('.rune-presence-avatar.is-following')).toBeTruthy();
    bar.destroy();
  });
});
