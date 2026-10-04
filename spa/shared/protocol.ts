import type { AnyValue, Doc } from '../src/lib/types'
// Governance-protocol contracts shared by the web app and server: which
// roles exist per body kind, which roles grant website access, and which
// task-force slugs are routable. Display labels live in the
// `content-options` document (teamLabels / assignmentLabels).
export const WEBSITE_PERMISSIONS = ['content_editor', 'content_publisher']

export function bodyRoles(kind: AnyValue) {
  if (kind === 'working_group') return ['member', 'contact_point']
  if (kind === 'operational_team') return ['member', 'liaison']
  if (kind === 'coordination') return ['member', 'coordinator']
  if (kind === 'council') return ['member', 'council_representative']
  return ['member']
}
/** Canonical task-force slugs a working group may publish as subpages. */
export const TASK_FORCE_SLUGS = new Set(['programming', 'policy', 'events-partnerships'])

export function normalizeTaskForces(value: AnyValue) {
  const raw = Array.isArray(value) ? value : []
  return raw
    .filter((item) => item?.slug && TASK_FORCE_SLUGS.has(item.slug))
    .map((item) => ({
      slug: item.slug,
      name: String(item.name || item.slug).trim(),
      purpose: String(item.purpose || '').trim(),
    }))
}

export function taskForceBySlug(group: Doc, slug: AnyValue) {
  return normalizeTaskForces(group?.taskForces).find((item) => item.slug === slug) || null
}
