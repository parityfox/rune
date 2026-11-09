// @vitest-environment node
// Regression for #193: the package ships source as-is, and bundlers don't
// compile JSX inside node_modules. Every published script must therefore be
// plain JavaScript — no .jsx/.tsx files, and no JSX syntax in .js files.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = fileURLToPath(new URL('../..', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function walk(path, out = []) {
  const st = statSync(path, { throwIfNoEntry: false });
  if (!st) return out;
  if (st.isFile()) { out.push(path); return out; }
  for (const name of readdirSync(path)) {
    if (name === 'node_modules') continue;
    walk(join(path, name), out);
  }
  return out;
}

const published = pkg.files.flatMap((entry) => walk(join(root, entry)));

describe('published package syntax (#193)', () => {
  it('finds the published files', () => {
    expect(published.some((f) => f.endsWith(join('adapters', 'react', 'RuneEditor.js')))).toBe(true);
  });

  it('ships no .jsx or .tsx files', () => {
    const bad = published.filter((f) => ['.jsx', '.tsx'].includes(extname(f)));
    expect(bad.map((f) => relative(root, f))).toEqual([]);
  });

  it('every published .js/.mjs file parses as plain JavaScript (no JSX)', () => {
    const failures = [];
    for (const file of published.filter((f) => ['.js', '.mjs'].includes(extname(f)))) {
      try {
        // esbuild's "js" loader rejects JSX syntax.
        transformSync(readFileSync(file, 'utf8'), { loader: 'js', format: 'esm', logLevel: 'silent' });
      } catch (err) {
        failures.push(`${relative(root, file)}: ${err.errors?.[0]?.text ?? err.message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
