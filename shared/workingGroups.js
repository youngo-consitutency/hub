/**
 * Canonical YOUNGO working groups for registration and Hub surfaces.
 * Keep in sync with data/fixtures.json `groups` (slug + name).
 */
export const WORKING_GROUPS = [
  { slug: 'ace', name: 'ACE' },
  { slug: 'finance', name: 'Finance & Markets' },
  { slug: 'adaptation', name: 'Adaptation' },
  { slug: 'loss-and-damage', name: 'Loss & Damage' },
  { slug: 'health', name: 'Health' },
  { slug: 'energy', name: 'Energy' },
  { slug: 'mitigation', name: 'Mitigation' },
  { slug: 'ndcs', name: 'NDCs' },
  { slug: 'oceans', name: 'Oceans' },
  { slug: 'agriculture', name: 'Food & Agriculture' },
  { slug: 'nature', name: 'Nature' },
  { slug: 'gender', name: 'Gender' },
  { slug: 'human-rights', name: 'Human Rights' },
  { slug: 'technology', name: 'Technology' },
  { slug: 'conflict-of-interest', name: 'Conflict of Interest' },
  { slug: 'coy', name: 'Conference of Youth' },
]

export const WORKING_GROUP_SLUGS = new Set(WORKING_GROUPS.map((g) => g.slug))

const WORKING_GROUP_NAMES = Object.fromEntries(
  WORKING_GROUPS.map((g) => [g.slug, g.name]),
)

/** Display name for a working-group slug; falls back to the slug. */
export function workingGroupLabel(slug) {
  if (!slug) return ''
  return WORKING_GROUP_NAMES[slug] || String(slug)
}

/** Keep known slugs only, de-duplicated, order preserved. */
export function sanitizeWgInterests(value) {
  const raw = Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean)
    : typeof value === 'string' && value.trim()
      ? [value.trim()]
      : []
  const seen = new Set()
  const out = []
  for (const slug of raw) {
    if (!WORKING_GROUP_SLUGS.has(slug) || seen.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}
