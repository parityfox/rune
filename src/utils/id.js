/**
 * Generates a short unique ID for blocks.
 * @returns {string}
 */
export function uid() {
  return crypto.randomUUID().slice(0, 8);
}
