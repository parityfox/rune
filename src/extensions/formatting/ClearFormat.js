/**
 * ClearFormat extension — toolbar button for the core `clearFormat` command.
 *
 * The command itself lives in core (Editor.js) and is always available; this
 * extension only surfaces it as a toolbar button so it can be placed, themed,
 * and toggled like any other formatting tool.
 *
 *   editor.cmd('clearFormat')  // strips inline formatting + links from selection
 */
export const ClearFormat = {
  name: 'clearFormat',
  type: 'formatting',

  toolbarItem: {
    name: 'clearFormat',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7V4h16v3"/>
      <path d="M5 20h6"/>
      <path d="M13 4 8 20"/>
      <path d="m15 15 5 5"/>
      <path d="m20 15-5 5"/>
    </svg>`,
    title: 'Clear Formatting',
    action: 'clearFormat',
    isActive: () => false,
  },
};
