// Names follow the 2025 Governance Policy and Interim GCT Mandate.
// Content permissions are software access, not additional YOUNGO mandates.
export const TEAM_LABELS = {
  membership_team: 'GCT · Membership',
  partnerships: 'GCT · Partnerships',
  gys_policy_team: 'Global Youth Statement Policy Team',
  content_editor: 'Website access · Draft content',
  content_publisher: 'Website access · Review and publish',
}
export const WEBSITE_PERMISSIONS = ['content_editor', 'content_publisher']
export const ASSIGNMENT_LABELS = {
  member: 'Member',
  contact: 'Working Group Contact Point',
  contact_point: 'Working Group Contact Point',
  liaison: 'Operational Team Liaison',
  coordinator: 'Coordinator',
  council_representative: 'Council representative',
  lead: 'Legacy working-group access',
}
export function bodyRoles(kind) {
  if (kind === 'working_group') return ['member', 'contact_point']
  if (kind === 'operational_team') return ['member', 'liaison']
  if (kind === 'coordination') return ['member', 'coordinator']
  if (kind === 'council') return ['member', 'council_representative']
  return ['member']
}
