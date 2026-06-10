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

// Resize handles: east (width), south (height), south-east (both).
const HANDLE_DIRS = ['e', 's', 'se'];

/** A single drag-to-resize grabber for the given direction. */
function _makeHandle(dir) {
  const handle = document.createElement('span');
  handle.className = `rune-video-handle rune-video-handle--${dir}`;
  handle.dataset.dir = dir;
  handle.contentEditable = 'false';
  handle.setAttribute('aria-hidden', 'true');
  return handle;
}

/** Make sure every video block has the full set of handles (covers loaded content). */
function _ensureHandles(root) {
  for (const wrap of root.querySelectorAll('.rune-video-block .rune-video-wrap')) {
    // Drop any legacy direction-less handle from the horizontal-only version.
    wrap.querySelectorAll('.rune-video-handle:not([data-dir])').forEach((h) => h.remove());
    for (const dir of HANDLE_DIRS) {
      if (!wrap.querySelector(`.rune-video-handle--${dir}`)) wrap.appendChild(_makeHandle(dir));
    }
  }
}

const MIN_VIDEO_WIDTH = 160; // px — keeps the embed usable when dragged narrow
const MIN_VIDEO_HEIGHT = 90; // px — keeps the embed usable when dragged short

export const VideoEmbed = {
  name: 'videoEmbed',
  type: 'block',
  tag: 'figure',
  match: (el) => el.classList.contains('rune-video-block'),

  // Bind a single delegated pointer handler for resizing, and make sure videos
  // loaded from saved HTML/JSON get a handle too.
  init(editor) {
    const content = editor.content;
    _ensureHandles(content);
    editor.events.on('change', () => _ensureHandles(content));

    let drag = null;

    content.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return; // ignore non-primary buttons
      const handle = e.target.closest?.('.rune-video-handle');
      if (!handle) return;
      const figure = handle.closest('.rune-video-block');
      const wrap = figure?.querySelector('.rune-video-wrap');
      if (!figure || !wrap) return;
      e.preventDefault();
      drag = {
        figure,
        wrap,
        dir: handle.dataset.dir || 'e',
        startX: e.clientX,
        startY: e.clientY,
        startW: figure.getBoundingClientRect().width,
        startH: wrap.getBoundingClientRect().height,
        containerW: content.getBoundingClientRect().width || 1,
      };
      figure.classList.add('rune-video-resizing');
      try { handle.setPointerCapture(e.pointerId); } catch { /* unsupported */ }
    });

    content.addEventListener('pointermove', (e) => {
      if (!drag) return;
      // Horizontal axis → width as a % of the content (stays fluid).
      if (drag.dir.includes('e')) {
        const raw = drag.startW + (e.clientX - drag.startX);
        const w = Math.max(MIN_VIDEO_WIDTH, Math.min(drag.containerW, raw));
        const pct = Math.round((w / drag.containerW) * 100);
        // 99%+ is effectively full width — drop the inline style so it stays fluid.
        drag.figure.style.width = pct >= 99 ? '' : `${pct}%`;
      }
      // Vertical axis → explicit height in px, which overrides the 16:9 default.
      if (drag.dir.includes('s')) {
        const raw = drag.startH + (e.clientY - drag.startY);
        drag.wrap.style.height = `${Math.round(Math.max(MIN_VIDEO_HEIGHT, raw))}px`;
      }
    });

    const end = () => {
      if (!drag) return;
      drag.figure.classList.remove('rune-video-resizing');
      drag = null;
      editor.history.saveNow();
      editor._notifyChange();
    };
    content.addEventListener('pointerup', end);
    content.addEventListener('pointercancel', end);
  },

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
        for (const dir of HANDLE_DIRS) wrap.appendChild(_makeHandle(dir));

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
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
