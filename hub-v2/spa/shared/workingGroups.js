/**
 * Canonical YOUNGO working groups for registration and Hub surfaces.
 * Keep in sync with data/fixtures.json `groups` (slug + name).
 */
export const WORKING_GROUPS = [
  { slug: 'ace', name: 'ACE' },
  { slug: 'ach', name: 'Arts, Culture and Heritage' },
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
  { slug: 'water', name: 'Water' },
  { slug: 'gender', name: 'Women & Gender' },
  { slug: 'human-rights', name: 'Human Rights' },
  { slug: 'child-rights', name: 'Child Rights' },
  { slug: 'peace-and-security', name: 'Peace & Security' },
  { slug: 'migration', name: 'Migration' },
  { slug: 'cities', name: 'Cities' },
  { slug: 'just-transition', name: 'Just Transition' },
  { slug: 'science', name: 'Science' },
  { slug: 'technology', name: 'Technology' },
  { slug: 'conflict-of-interest', name: 'Conflict of Interest' },
  { slug: 'coy', name: 'Conference of Youth' },
]

/** Broad, member-facing topics. Each working group belongs to one category. */
export const WORKING_GROUP_TOPICS = [
  {
    key: 'climate-action',
    label: 'Climate action',
    groups: ['adaptation', 'loss-and-damage', 'mitigation', 'ndcs', 'science'],
  },
  {
    key: 'nature-food',
    label: 'Nature & food',
    groups: ['oceans', 'agriculture', 'nature', 'water'],
  },
  {
    key: 'people-rights',
    label: 'People & rights',
    groups: [
      'health',
      'gender',
      'human-rights',
      'child-rights',
      'peace-and-security',
      'migration',
    ],
  },
  {
    key: 'economy-technology',
    label: 'Finance, energy & tech',
    groups: ['finance', 'energy', 'technology', 'just-transition', 'cities'],
  },
  {
    key: 'participation-learning',
    label: 'Participation & learning',
    groups: ['ace', 'ach', 'coy'],
  },
  {
    key: 'governance-integrity',
    label: 'Governance & integrity',
    groups: ['conflict-of-interest'],
  },
]

const WORKING_GROUP_TOPIC_BY_SLUG = new Map(
  WORKING_GROUP_TOPICS.flatMap((topic) =>
    topic.groups.map((slug) => [slug, topic]),
  ),
)

/** Canonical broad topic shown by both group filters and group cards. */
export function workingGroupTopic(slug) {
  return WORKING_GROUP_TOPIC_BY_SLUG.get(slug) || null
}

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
