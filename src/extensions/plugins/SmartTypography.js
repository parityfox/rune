/**
 * SmartTypography — replace ASCII shortcuts with typographic characters as you
 * type, and linkify bare URLs on paste. Pure data-driven input/paste rules.
 */
export const SmartTypography = {
  name: 'smartTypography',
  type: 'plugin',

  inputRules: [
    { find: /--$/,        replace: '—' },                 // -- → em dash
    { find: /\.\.\.$/,    replace: '…' },                 // ... → ellipsis
    { find: /->$/,        replace: '→' },                 // -> → arrow
    { find: /<-$/,        replace: '←' },                 // <- → arrow
    { find: /\(c\)$/i,    replace: '©' },                 // (c) → ©
    { find: /\(r\)$/i,    replace: '®' },                 // (r) → ®
    { find: /\(tm\)$/i,   replace: '™' },                 // (tm) → ™
    // Smart quotes — opening forms first (preceded by start/space/paren),
    // otherwise closing.
    { find: /(^|[\s([{])"$/, replace: (m) => m[1] + '“' },
    { find: /"$/,            replace: '”' },
    { find: /(^|[\s([{])'$/, replace: (m) => m[1] + '‘' },
    { find: /'$/,            replace: '’' },
  ],

  pasteRules: [
    // Linkify bare http(s) URLs in pasted text.
    {
      find: /\bhttps?:\/\/[^\s<>"']+/g,
      replace: (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
    },
  ],
};
