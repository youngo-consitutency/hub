// Match the server's derived capabilities; group membership alone is not a
// management responsibility. These control presentation, never API access.
export function canManageGroups(account: any) {
  return Boolean(
    account?.access?.manageAllWgs ||
    account?.access?.capabilities?.some((value: any) => value.startsWith('wg.manage:')),
  )
}

export function canManageGroup(account: any, slug: any) {
  return Boolean(
    account?.access?.manageAllWgs || account?.access?.capabilities?.includes(`wg.manage:${slug}`),
  )
}
