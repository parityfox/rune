/**
 * Generates a short unique ID for blocks.
 * @returns {string}
 */
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
