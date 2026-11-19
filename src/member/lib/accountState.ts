import type { Account } from './types'

// endpoints hand back a bare accountView. for the same account keep the access
// state we hold (loaded, or failed and awaiting retry); anything else replaces it
export function mergeAccount(current: Account | null, next: Account | null): Account | null {
  if (!next || next.access || current?.id !== next.id) return next
  return {
    ...next,
    ...(current.access && { access: current.access }),
    ...(current.accessFailed && { accessFailed: true }),
  }
}

// access we hold is stale once something may have moved it. dropping it means a
// failed refetch lands on the retry lock, not a wrong "access required"
export function withoutAccess(current: Account | null): Account | null {
  if (!current) return current
  const { access: _stale, ...rest } = current
  return { ...rest, accessFailed: false }
}
