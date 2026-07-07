import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { MemoryHub } from '../collab/memory-hub.js';
import { bindPresence, _safeColor } from '../collab/presence.js';
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

  // #123: a remote peer controls their user.color; computeRoster (the public
  // getUsers() payload, consumed by PresenceBar's style.background) must launder
  // it through _safeColor so a url() beacon can't fire in every peer's browser.
  it('launders a hostile peer color out of the roster (#123)', () => {
    pB.setUser({ name: 'Bob', color: 'url(https://evil.example/beacon)' });
    const bob = pA.getUsers().find((u) => u.name === 'Bob');
    expect(bob).toBeTruthy();
    expect(bob.color).toBe('#888');            // beacon payload replaced with default
    expect(bob.color).not.toContain('url(');
  });

  it('PresenceBar renders a safe background for a hostile peer color (#123)', () => {
    pB.setUser({ name: 'Bob', color: 'url(https://evil.example/beacon)' });
    const bar = new PresenceBar(pA, tA);
    const avatar = tA.querySelector('.rune-presence-avatar');
    expect(avatar).toBeTruthy();
    expect(avatar.getAttribute('style') || '').not.toContain('url(');
    bar.destroy();
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

describe('_safeColor rejects CSS injection via a peer\'s user.color', () => {
  it('passes through valid colors unchanged', () => {
    expect(_safeColor('#f00')).toBe('#f00');
    expect(_safeColor('#ff000080')).toBe('#ff000080');
    expect(_safeColor('rebeccapurple')).toBe('rebeccapurple');
    expect(_safeColor('rgb(10, 20, 30)')).toBe('rgb(10, 20, 30)');
    expect(_safeColor('hsla(200 50% 50% / 0.5)')).toBe('hsla(200 50% 50% / 0.5)');
  });

  it('drops declaration-breakout and url() beacon payloads to the default', () => {
    // Full-viewport overlay for clickjacking.
    expect(_safeColor('red;position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647'))
      .toBe('#888');
    // CSS beacon / exfil.
    expect(_safeColor('url(https://evil.example/beacon)')).toBe('#888');
    expect(_safeColor('#888;background:url(https://evil.example/x)')).toBe('#888');
    // Non-strings and empties fall back safely.
    expect(_safeColor(undefined)).toBe('#888');
    expect(_safeColor('')).toBe('#888');
    expect(_safeColor({})).toBe('#888');
  });
});
