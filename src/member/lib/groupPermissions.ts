/** What these checks read: any account-like value carrying capabilities. */
type WithCapabilities =
  { access?: { manageAllWgs?: boolean; capabilities?: string[] } } | null | undefined

// Match the server's derived capabilities; group membership alone is not a
// management responsibility. These control presentation, never API access.
export function canManageGroups(account: WithCapabilities) {
  return Boolean(
    account?.access?.manageAllWgs ||
    account?.access?.capabilities?.some((value) => value.startsWith('wg.manage:')),
  )
}

export function canManageGroup(account: WithCapabilities, slug: string) {
  return Boolean(
    account?.access?.manageAllWgs || account?.access?.capabilities?.includes(`wg.manage:${slug}`),
  )
}
