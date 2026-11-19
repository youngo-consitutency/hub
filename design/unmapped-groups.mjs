/**
 * Keeps the design in step with the Hub: lists working groups that exist in the Hub but have no
 * theme in design/wg-map.json (they render in the brand green until mapped), and
 * mappings that point at groups the Hub no longer has.
 *
 *   HUB_URL=https://youngo-hub.vercel.app npm run design:groups
 *
 * Reads only the public groups endpoint. Exits 0: an unmapped group is a prompt, not a failure.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = process.env.HUB_URL
if (!base) {
  console.error('Set HUB_URL, e.g. HUB_URL=http://localhost:3000')
  process.exit(1)
}
const themes = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'wg-map.json'), 'utf8'),
)
const res = await fetch(new URL('/api/groups', base))
if (!res.ok) {
  console.error(`GET /api/groups failed: ${res.status}`)
  process.exit(1)
}
const groups = (await res.json()).items ?? []
const slugs = new Set(groups.map((g) => g.slug))
const unmapped = groups.filter((g) => !themes.groups[g.slug])
const stale = Object.keys(themes.groups).filter((s) => !slugs.has(s))

console.log(`${groups.length} groups in the Hub, ${Object.keys(themes.groups).length} mapped.`)
if (unmapped.length) {
  console.log('\nNo theme yet (brand green until you add them to design/wg-map.json):')
  for (const g of unmapped) console.log(`  "${g.slug}": "forest",   // ${g.name}`)
}
if (stale.length) console.log(`\nMapped but not in the Hub: ${stale.join(', ')}`)
if (!unmapped.length && !stale.length) console.log('Every group has a theme.')
