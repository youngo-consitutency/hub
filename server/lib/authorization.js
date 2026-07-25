const WG_MANAGER_ROLES = new Set(['contact', 'lead'])
const NGO_REQUEST_WRITERS = new Set(['representative', 'owner'])

export function canManageWg(account, progress, requestedWg) {
  if (account?.role === 'admin') return true
  return Boolean(
    account?.isVerified &&
    progress &&
    progress.account_id === account.id &&
    progress.wg_slug === requestedWg &&
    progress.status === 'active' &&
    WG_MANAGER_ROLES.has(progress.role_in_wg)
  )
}

export function canReadNgo(context) {
  return Boolean(context?.isAdmin || ['viewer', 'representative', 'owner'].includes(context?.seatRole))
}

export function canWriteNgoRequests(context) {
  return Boolean(context?.isAdmin || NGO_REQUEST_WRITERS.has(context?.seatRole))
}

export function canManageNgoSeats(context) {
  return Boolean(context?.isAdmin || context?.seatRole === 'owner')
}

