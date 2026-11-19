/* eslint-disable @typescript-eslint/no-explicit-any --
 * Boundary aliases for untyped REST values and view models; named so `any` stays greppable.
 */

/** An untyped JSON object row at an API boundary. */
export type Doc = Record<string, any>

/** An untyped scalar, object, or callable at a boundary. */
export type AnyValue = any

import type { AccessProfile } from '../../lib/access'
import type { AccountView } from '../../lib/domain'

/** GET /api/member/access: the derived capabilities plus a few flags the UI needs. */
export type AccountAccess = AccessProfile & {
  canAdminister: boolean
  managedWgs: string[]
  /** The member's active seat in an organisation team, if any. */
  ngo: { orgAccountId: number; seatRole: string } | null
}

/** The signed-in member: the server's account view plus the capabilities loaded after sign-in. */
export type Account = AccountView & {
  /** Absent until GET /api/member/access answers. */
  access?: AccountAccess
  /** True when that request failed and the page is waiting on a retry. */
  accessFailed?: boolean
}
