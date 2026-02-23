import { el } from '../../utils/dom.js';
import { uid } from '../../utils/id.js';

export const Image = {
  name: 'image',
  type: 'block',
  tag: 'figure',

  commands(editor) {
    return {
      insertImage(src, alt = '', caption = '') {
        if (!src) return;
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
      },
    };
  },

  toolbarItem: {
    name: 'image',
    type: 'panel',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">
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
        const reader = new FileReader();
        reader.onload = (e) => {
          editor.cmd('insertImage', e.target.result, file.name);
          close();
        };
        reader.readAsDataURL(file);
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
        const reader = new FileReader();
        reader.onload = (e) => editor.cmd('insertImage', e.target.result, file.name);
        reader.readAsDataURL(file);
      };
      input.click();
    },
  },
};
