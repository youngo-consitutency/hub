import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ESLint has no module resolver configured, so a relative import that points at
// nothing is not a lint error — it only fails at runtime, and then only on the
// code path that loads it. Moving a file between directories is the usual cause.
// This walks every source file and checks each relative specifier resolves.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOTS = ['src', 'server', 'shared', 'scripts', 'tests']
const SKIP = new Set(['node_modules', 'dist', '.git'])
const SOURCE = /\.(js|jsx|mjs)$/

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (SOURCE.test(entry.name)) out.push(full)
  }
  return out
}

// Static imports, re-exports, dynamic imports, and side-effect imports.
const SPECIFIER =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]/g

function resolves(fromFile, specifier) {
  const target = path.resolve(path.dirname(fromFile), specifier)
  if (existsSync(target)) {
    // A directory import must provide its own index file.
    if (statSync(target).isDirectory()) {
      return ['index.js', 'index.jsx', 'index.mjs'].some((i) =>
        existsSync(path.join(target, i)),
      )
    }
    return true
  }
  // Extensionless specifiers are not used in this codebase, but tolerate them.
  return ['.js', '.jsx', '.mjs'].some((ext) => existsSync(target + ext))
}

test('every relative import resolves to a file that exists', () => {
  const broken = []
  let checked = 0

  for (const dir of ROOTS) {
    const abs = path.join(root, dir)
    if (!existsSync(abs)) continue
    for (const file of sourceFiles(abs)) {
      // This file describes import syntax, so scanning it matches its own
      // pattern source rather than real dependencies.
      if (file === fileURLToPath(import.meta.url)) continue
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(SPECIFIER)) {
        const specifier = match[1] || match[2] || match[3]
        // Bare specifiers are package names — npm resolves those.
        if (!specifier || !specifier.startsWith('.')) continue
        checked += 1
        if (!resolves(file, specifier)) {
          broken.push(`${path.relative(root, file)} -> ${specifier}`)
        }
      }
    }
  }

  assert.ok(checked > 0, 'expected to find relative imports to check')
  assert.deepEqual(broken, [], `unresolved imports:\n${broken.join('\n')}`)
})
