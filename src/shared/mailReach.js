/**
 * Who may draft Hub mail and to whom, derived from authority capabilities.
 * Contact points reach their own working groups; focal points, the comms
 * team and operational-team liaisons reach the whole constituency.
 * Shared by the Mail Desk endpoints and the Shell nav.
 *
 * @param {{ capabilities?: string[] } | null | undefined} access
 */
export function mailReach(access) {
  const capabilities = access?.capabilities || []
  const everyone =
    capabilities.includes('notifications.send') ||
    capabilities.includes('constituency.coordinate') ||
    capabilities.includes('wg.manage_all') ||
    capabilities.some((cap) => cap.startsWith('ot.coordinate:'))
  const wgSlugs = capabilities
    .filter((cap) => cap.startsWith('wg.manage:'))
    .map((cap) => cap.slice('wg.manage:'.length))
    .filter((slug, i, all) => slug && all.indexOf(slug) === i)
    .sort()
  return { canDraft: everyone || wgSlugs.length > 0, everyone, wgSlugs }
}

export const MAIL_SCOPES = ['working_group', 'constituency', 'individual']
export const MAX_INDIVIDUAL_RECIPIENTS = 20
