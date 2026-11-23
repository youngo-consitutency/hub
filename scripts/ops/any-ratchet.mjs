/** Counts `AnyValue` uses and fails if the number goes up; run with --update to write the new baseline. */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const baselineFile = join(dirname(fileURLToPath(import.meta.url)), 'any-baseline.json')
const SKIP = new Set(['node_modules', 'migrations', '.next'])

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (/\.(ts|tsx)$/.test(name) && name !== 'payload-types.ts') yield path
  }
}

const perFile = {}
let total = 0
for (const file of walk(join(root, 'src'))) {
  // forward slashes on every platform, so the definition check and the baseline keys match on Windows
  const rel = file.slice(root.length + 1).replaceAll('\\', '/')
  const n = (readFileSync(file, 'utf8').match(/\bAnyValue\b/g) ?? []).length
  // the two definitions are not uses
  const uses = /(^|\/)(lib\/types|lib\/domain)\.ts$/.test(rel) ? Math.max(0, n - 3) : n
  if (uses) perFile[rel] = uses
  total += uses
}

if (process.argv.includes('--update')) {
  writeFileSync(baselineFile, JSON.stringify({ total, perFile }, null, 2) + '\n')
  console.log(`baseline written: ${total} uses in ${Object.keys(perFile).length} files`)
} else {
  const base = JSON.parse(readFileSync(baselineFile, 'utf8'))
  const grew = Object.entries(perFile).filter(([f, n]) => n > (base.perFile[f] ?? 0))
  if (total > base.total || grew.length) {
    console.error(`AnyValue grew: ${base.total} -> ${total}`)
    for (const [f, n] of grew) console.error(`  ${f}: ${base.perFile[f] ?? 0} -> ${n}`)
    console.error('Use a real type, or run with --update if the increase is deliberate.')
    process.exit(1)
  }
  console.log(`AnyValue ratchet OK: ${total} (baseline ${base.total})`)
}
