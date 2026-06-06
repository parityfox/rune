// Build input for the collab demo's vendored deps. Bundling yjs and
// y-protocols/awareness through one entry guarantees the awareness binding
// shares the editor's single Yjs instance (two copies would not interoperate).
// Rebuild with: npm run build:demo
export * from 'yjs';
export * from 'y-protocols/awareness';
export * from 'y-indexeddb';
