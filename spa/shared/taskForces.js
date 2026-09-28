/** Canonical task-force slugs a working group may publish as subpages. */
export const TASK_FORCE_SLUGS = new Set([
  'programming',
  'policy',
  'events-partnerships',
])

export function normalizeTaskForces(value) {
  const raw = Array.isArray(value) ? value : []
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
    normalizeTaskForces(group?.taskForces).find(
      (item) => item.slug === slug,
    ) || null
  )
}

export function wgDutyRoleLabel(role) {
  if (role === 'lead') return 'Lead'
  if (role === 'contact') return 'Contact Point'
  return null
}
