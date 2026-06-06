import { el } from '../../utils/dom.js';
import { uid } from '../../utils/id.js';
import { _isDangerousUrl } from '../../utils/html.js';

/**
 * Read a File, insert it as a base64 preview immediately, then swap
 * the src for a real URL if editor.options.uploadImage is provided.
 *
 * editor.options.uploadImage = (file) => Promise<string>
 */
function _handleFile(editor, file, close) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const figure = editor.cmd('insertImage', ev.target.result, file.name);
    close?.();

    const uploadFn = editor.options.uploadImage;
    if (typeof uploadFn === 'function' && figure) {
      figure.classList.add('is-uploading');
      uploadFn(file)
        .then(url => {
          const img = figure.querySelector('img');
          if (img) img.src = url;
          figure.classList.remove('is-uploading');
          editor._notifyChange();
        })
        .catch(err => {
          console.error('[Rune] uploadImage hook failed:', err);
          figure.classList.remove('is-uploading');
        });
    }
  };
  reader.readAsDataURL(file);
}

export const Image = {
  name: 'image',
  type: 'block',
  tag: 'figure',
  match: (el) => el.classList.contains('rune-image-block'),

  commands(editor) {
    return {
      insertImage(src, alt = '', caption = '') {
        if (!src || _isDangerousUrl(src)) return;
        editor.history.saveNow();

        const figure = document.createElement('figure');
        figure.setAttribute('data-id', uid());
        figure.className = 'rune-image-block';

        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.style.maxWidth = '100%';
        figure.appendChild(img);

        if (caption) {
          const cap = document.createElement('figcaption');
          cap.textContent = caption;
          figure.appendChild(cap);
        } else {
          // Editable empty caption
          const cap = document.createElement('figcaption');
          cap.setAttribute('data-placeholder', 'Add a caption…');
          cap.contentEditable = 'true';
          figure.appendChild(cap);
        }

        const currentBlock = editor.selection.getBlock();
        if (currentBlock && currentBlock.nextSibling) {
          editor.content.insertBefore(figure, currentBlock.nextSibling);
        } else {
          editor.content.appendChild(figure);
        }

        // Insert a new paragraph after
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        editor.content.insertBefore(p, figure.nextSibling || null);
        editor.selection.setAtStart(p);
        editor._notifyChange();

        return figure; // returned so upload hook can swap src later
      },
    };
  },

  toolbarItem: {
    name: 'image',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>`,
    title: 'Insert Image',
    indicator: false,

    renderPanel(editor, close) {
      const wrap = el('div', { class: 'rune-panel-image' });

      // ── Upload tab ────────────────────────────────────────
      const uploadLabel = el('div', { class: 'rune-panel-section-label' }, 'UPLOAD');
      const uploadZone  = el('label', { class: 'rune-image-upload-zone', for: '_runeFileInput' });
      uploadZone.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span>Click to upload</span>
        <small>PNG, JPG, GIF, WEBP</small>`;

      const fileInput = el('input', { type: 'file', id: '_runeFileInput', accept: 'image/*', style: 'display:none' });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        _handleFile(editor, file, close);
      });

      // ── URL tab ───────────────────────────────────────────
      const urlLabel = el('div', { class: 'rune-panel-section-label' }, 'FROM URL');
      const urlRow   = el('div', { class: 'rune-panel-url-row' });
      const urlInput = el('input', {
        type: 'text',
        class: 'rune-panel-input',
        placeholder: 'Paste image URL…',
      });
      const urlBtn = el('button', { class: 'rune-panel-btn-primary', type: 'button' }, 'Insert');
      urlBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const src = urlInput.value.trim();
        if (src) { editor.cmd('insertImage', src); close(); }
      });
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); const src = urlInput.value.trim(); if (src) { editor.cmd('insertImage', src); close(); } }
      });
      urlRow.appendChild(urlInput);
      urlRow.appendChild(urlBtn);

      wrap.appendChild(uploadLabel);
      wrap.appendChild(uploadZone);
      wrap.appendChild(fileInput);
      wrap.appendChild(urlLabel);
      wrap.appendChild(urlRow);
      return wrap;
    },

    isActive: (editor) => editor.selection.getBlock()?.tagName === 'FIGURE',
  },

  slashItem: {
    icon: '🖼',
    title: 'Image',
    description: 'Upload or embed an image',
    action(editor) {
      // Programmatic open via a hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        _handleFile(editor, file, null);
      };
      input.click();
    },
  },
};
