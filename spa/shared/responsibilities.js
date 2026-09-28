// Role contracts from the governance policy: which roles exist and which
// scope grants website access. Display labels live in the `content-options`
// document (teamLabels / assignmentLabels), loaded via useContentOptions.
export const WEBSITE_PERMISSIONS = ['content_editor', 'content_publisher']

export function bodyRoles(kind) {
  if (kind === 'working_group') return ['member', 'contact_point']
  if (kind === 'operational_team') return ['member', 'liaison']
  if (kind === 'coordination') return ['member', 'coordinator']
  if (kind === 'council') return ['member', 'council_representative']
  return ['member']
}
