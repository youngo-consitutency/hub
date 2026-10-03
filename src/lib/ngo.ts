import type { PayloadRequest } from 'payload'
import { fail } from './respond'
import { requireVerifiedMember } from './accounts'
import { toCamelCase } from './case'

// Organisation-scope helpers shared by the NGO, organisations and
// opportunities endpoints. Access derives from the member's active
// `ngo-seats` row — never from a global role alone.

export const AFFILIATION_ROLES = ['affiliate', 'viewer', 'representative']

export type OrgContext = {
  orgAccountId: string
  seatRole: string
  canManageRequests: boolean
  canManageSeats: boolean
}

/** Resolve the organisation scope an account is acting in, from its active seat or an admin's org query. */
async function resolveOrgContext(req: PayloadRequest, account: any): Promise<OrgContext | null> {
  const requestedOrgId = (req.query?.orgId as string) || (req.body as any)?.orgId || null
  if (account.role === 'admin') {
    if (!requestedOrgId) return null
    return {
      orgAccountId: String(requestedOrgId),
      seatRole: 'owner',
      canManageRequests: true,
      canManageSeats: true,
    }
  }
  const { docs } = await req.payload.find({
    collection: 'ngo-seats',
    where: {
      memberAccount: { equals: account.id },
      status: { equals: 'active' },
      ...(requestedOrgId ? { orgAccount: { equals: requestedOrgId } } : {}),
    },
    sort: '-acceptedAt',
    limit: 1,
    overrideAccess: true,
  })
  const seat = docs[0] as any
  if (!seat) return null
  return {
    orgAccountId: String(
      typeof seat.orgAccount === 'object' ? seat.orgAccount.id : seat.orgAccount,
    ),
    seatRole: seat.seatRole,
    canManageRequests: ['owner', 'representative'].includes(seat.seatRole),
    canManageSeats: seat.seatRole === 'owner',
  }
}

export async function requireOrgScope(
  req: PayloadRequest,
  permission: 'read' | 'requests' | 'seats' = 'read',
) {
  const account = requireVerifiedMember(req)
  const ctx = await resolveOrgContext(req, account)
  if (!ctx) throw fail.forbidden('Accredited NGO access required.')
  if (permission === 'requests' && !ctx.canManageRequests)
    throw fail.forbidden('Your seat cannot post requests for this organisation.')
  if (permission === 'seats' && !ctx.canManageSeats)
    throw fail.forbidden('Only the organisation owner can manage seats.')
  return { account, ctx }
}

/** Normalise an ngo-seat row (document or raw SQL) into its public API shape. */
export const seatView = (row: any) => {
  const r = toCamelCase<any>(row)
  return {
    id: r.id,
    orgAccountId:
      typeof r.orgAccount === 'object' ? r.orgAccount?.id : (r.orgAccount ?? r.orgAccountId),
    memberAccountId:
      typeof r.memberAccount === 'object'
        ? r.memberAccount?.id
        : (r.memberAccount ?? r.memberAccountId ?? null),
    email: r.email ?? null,
    name: r.name || null,
    seatRole: r.seatRole,
    status: r.status,
    inviteExpiresAt: r.inviteExpiresAt ?? null,
    createdAt: r.createdAt,
    acceptedAt: r.acceptedAt ?? null,
    memberName: r.memberName || r.name || null,
    memberEmail: r.memberEmail || r.email || null,
  }
}
