import { el } from '../../utils/dom.js';
import { uid } from '../../utils/id.js';

function parseVideoUrl(url) {
  url = url.trim();
  // YouTube: watch?v=, youtu.be/, /embed/
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?rel=0`;

  // Vimeo: vimeo.com/ID
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;

  return null;
}

export const VideoEmbed = {
  name: 'videoEmbed',
  type: 'block',
  tag: 'figure',
  match: (el) => el.classList.contains('rune-video-block'),

  commands(editor) {
    return {
      insertVideo(url) {
        const embedUrl = parseVideoUrl(url);
        if (!embedUrl) { alert('Could not parse video URL. Paste a YouTube or Vimeo link.'); return; }
        editor.history.saveNow();

        const figure = document.createElement('figure');
        figure.className = 'rune-video-block';
        figure.setAttribute('data-id', uid());

        const wrap = document.createElement('div');
        wrap.className = 'rune-video-wrap';

        const iframe = document.createElement('iframe');
        iframe.src = embedUrl;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');

        wrap.appendChild(iframe);

        const cap = document.createElement('figcaption');
        cap.setAttribute('data-placeholder', 'Add a caption…');
        cap.setAttribute('contenteditable', 'true');

        figure.appendChild(wrap);
        figure.appendChild(cap);

        const currentBlock = editor.selection.getBlock();
        const after = currentBlock?.nextSibling || null;
        if (currentBlock && currentBlock.textContent.trim() === '') {
          editor.content.replaceChild(figure, currentBlock);
        } else {
          editor.content.insertBefore(figure, after);
        }

        // Paragraph after so user can keep typing
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        editor.content.insertBefore(p, figure.nextSibling || null);
        editor.selection.setAtStart(p);
        editor._notifyChange();
      },
    };
  },

  toolbarItem: {
    name: 'videoEmbed',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <polygon points="10 9 16 12 10 15" fill="currentColor" stroke="none"/>
    </svg>`,
    title: 'Video Embed',
    indicator: false,

    renderPanel(editor, close) {
      const wrap    = el('div', { class: 'rune-panel-video' });
      const label   = el('div', { class: 'rune-panel-section-label' }, 'YOUTUBE OR VIMEO URL');
      const urlRow  = el('div', { class: 'rune-panel-url-row' });
      const input   = el('input', { type: 'text', class: 'rune-panel-input', placeholder: 'Paste video URL…' });
      const btn     = el('button', { class: 'rune-panel-btn-primary', type: 'button' }, 'Embed');

      const submit = () => {
        const url = input.value.trim();
        if (!url) return;
        editor.cmd('insertVideo', url);
        close();
      };

      btn.addEventListener('mousedown', (e) => { e.preventDefault(); submit(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

      const hint = el('div', { class: 'rune-panel-hint' }, 'Supports YouTube and Vimeo links');

      urlRow.appendChild(input);
      urlRow.appendChild(btn);
      wrap.appendChild(label);
      wrap.appendChild(urlRow);
      wrap.appendChild(hint);
      return wrap;
    },

    isActive: (editor) => editor.selection.getBlock()?.classList.contains('rune-video-block'),
  },

  slashItem: {
    icon: '▶',
    title: 'Video',
    description: 'Embed a YouTube or Vimeo video',
    action(editor) {
      const url = prompt('Paste a YouTube or Vimeo URL:');
      if (url) editor.cmd('insertVideo', url);
    },
  },
};
