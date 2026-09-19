/** Canonical task-force slugs a working group may publish as subpages. */
export const TASK_FORCE_SLUGS = new Set([
  'programming',
  'policy',
  'events-partnerships',
])

export const DEFAULT_TASK_FORCES = {
  ach: [
    {
      slug: 'programming',
      name: 'Programming',
      purpose:
        'Sessions, workshops, and creative programmes the working group runs for members and partners.',
    },
    {
      slug: 'policy',
      name: 'Policy',
      purpose:
        'UNFCCC and related policy inputs where arts, culture, and heritage meet climate negotiations.',
    },
    {
      slug: 'events-partnerships',
      name: 'Events and partnerships',
      purpose:
        'Public events, partner organisations, and collaborations the group hosts or joins.',
    },
  ],
}

export function normalizeTaskForces(value, groupSlug) {
  const raw = Array.isArray(value)
    ? value
    : DEFAULT_TASK_FORCES[groupSlug] || []
  return raw
    .filter((item) => item?.slug && TASK_FORCE_SLUGS.has(item.slug))
    .map((item) => ({
      slug: item.slug,
      name: String(item.name || item.slug).trim(),
      purpose: String(item.purpose || '').trim(),
    }))
}

export function taskForceBySlug(group, slug) {
  return (
    normalizeTaskForces(group?.taskForces, group?.slug).find(
      (item) => item.slug === slug,
    ) || null
  )
}

export function wgDutyRoleLabel(role) {
  if (role === 'lead') return 'Lead'
  if (role === 'contact') return 'Contact Point'
  return null
}
