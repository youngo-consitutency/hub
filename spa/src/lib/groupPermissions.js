// Match the server's derived capabilities; group membership alone is not a
// management responsibility. These control presentation, never API access.
export function canManageGroups(account) {
  return Boolean(
    account?.access?.manageAllWgs ||
    account?.access?.capabilities?.some((value) => value.startsWith('wg.manage:')),
  )
}

export function canManageGroup(account, slug) {
  return Boolean(
    account?.access?.manageAllWgs || account?.access?.capabilities?.includes(`wg.manage:${slug}`),
  )
}
