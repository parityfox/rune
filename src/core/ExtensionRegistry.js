/**
 * ExtensionRegistry — order and validate extensions by their optional manifest.
 *
 * An extension may declare manifest fields:
 *   { name, version?, kind?, dependsOn?: string[], conflictsWith?: string[],
 *     lazy?: () => Promise<{ default?: Extension } | Extension> }
 *
 * resolveExtensions() de-dupes by name, rejects conflicts, missing dependencies,
 * and dependency cycles, and returns the list topologically ordered so an
 * extension is always registered after the ones it depends on. Extensions
 * without manifest fields are treated as having no dependencies (so existing
 * StarterKit ordering is preserved).
 */
export function resolveExtensions(extensions) {
  const byName = new Map();
  for (const ext of extensions || []) {
    if (!ext || !ext.name) throw new Error('[Rune] Every extension must have a name.');
    if (!byName.has(ext.name)) byName.set(ext.name, ext);     // first registration wins
  }
  const list = [...byName.values()];

  // Explicit conflicts
  for (const ext of list) {
    for (const c of ext.conflictsWith || []) {
      if (byName.has(c)) throw new Error(`[Rune] Extension "${ext.name}" conflicts with "${c}".`);
    }
  }

  // Missing dependencies
  for (const ext of list) {
    for (const d of ext.dependsOn || []) {
      if (!byName.has(d)) throw new Error(`[Rune] Extension "${ext.name}" depends on missing extension "${d}".`);
    }
  }

  // Topological order (DFS), detecting cycles.
  const ordered = [];
  const state = new Map();   // name -> 'visiting' | 'done'
  const visit = (ext) => {
    const s = state.get(ext.name);
    if (s === 'done') return;
    if (s === 'visiting') throw new Error(`[Rune] Circular extension dependency at "${ext.name}".`);
    state.set(ext.name, 'visiting');
    for (const d of ext.dependsOn || []) visit(byName.get(d));
    state.set(ext.name, 'done');
    ordered.push(ext);
  };
  for (const ext of list) visit(ext);
  return ordered;
}

/** Normalise a lazy() module result (default export or the extension itself). */
export function unwrapLazy(mod) {
  return mod && mod.default ? mod.default : mod;
}
