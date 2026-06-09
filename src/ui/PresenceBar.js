import { el } from '../utils/dom.js';

/**
 * PresenceBar — an avatar stack for collaboration presence. Consumes a presence
 * handle (from bindPresence / collab().presence): one circle per remote user,
 * reflecting active/idle/away state, with click-to-follow.
 *
 *   const bar = new PresenceBar(session.presence, document.querySelector('#bar'));
 */
export class PresenceBar {
  constructor(presence, container) {
    this.presence = presence;
    this._following = null;
    this.el = el('div', { class: 'rune-presence-bar', role: 'group', 'aria-label': 'Collaborators' });
    container?.appendChild(this.el);

    this._render(presence.getUsers());
    this._unsub = presence.on('change', (roster) => this._render(roster));
  }

  _render(roster) {
    this.el.textContent = '';
    for (const u of roster) {
      if (u.isSelf) continue;
      const avatar = el('button', {
        class: `rune-presence-avatar is-${u.state || 'active'}${this._following === u.id ? ' is-following' : ''}`,
        type: 'button',
        title: `${u.name || 'Anon'}${u.state && u.state !== 'active' ? ` (${u.state})` : ''}`,
        'aria-label': `Follow ${u.name || 'Anon'}`,
      });
      avatar.style.background = u.color || '#888';
      avatar.textContent = u.avatar || (u.name ? u.name[0].toUpperCase() : '?');
      avatar.addEventListener('click', () => {
        if (this._following === u.id) { this._following = null; this.presence.unfollow(); }
        else { this._following = u.id; this.presence.follow(u.id); }
        this._render(this.presence.getUsers());
      });
      this.el.appendChild(avatar);
    }
  }

  destroy() {
    this._unsub?.();
    this.el.remove();
  }
}
