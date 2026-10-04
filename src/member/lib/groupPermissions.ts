import type { AnyValue, Doc } from './types'
// Match the server's derived capabilities; group membership alone is not a
// management responsibility. These control presentation, never API access.
export function canManageGroups(account: Doc) {
  return Boolean(
    account?.access?.manageAllWgs ||
    account?.access?.capabilities?.some((value: AnyValue) => value.startsWith('wg.manage:')),
  )
}

export function canManageGroup(account: Doc, slug: AnyValue) {
  return Boolean(
    account?.access?.manageAllWgs || account?.access?.capabilities?.includes(`wg.manage:${slug}`),
  )
}
