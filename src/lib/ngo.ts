import type { PayloadRequest } from 'payload'
import { fail } from './respond'
import { requireVerifiedMember } from './accounts'

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

export async function resolveOrgContext(
  req: PayloadRequest,
  account: any,
): Promise<OrgContext | null> {
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

export const seatView = (row: any) => ({
  id: row.id,
  orgAccountId:
    typeof row.orgAccount === 'object'
      ? row.orgAccount?.id
      : (row.orgAccount ?? row.org_account_id),
  memberAccountId:
    typeof row.memberAccount === 'object'
      ? row.memberAccount?.id
      : (row.memberAccount ?? row.member_account_id ?? null),
  email: row.email ?? null,
  name: row.name || null,
  seatRole: row.seatRole ?? row.seat_role,
  status: row.status,
  inviteExpiresAt: row.inviteExpiresAt ?? row.invite_expires_at ?? null,
  createdAt: row.createdAt ?? row.created_at,
  acceptedAt: row.acceptedAt ?? row.accepted_at ?? null,
  memberName: row.member_name || row.name || null,
  memberEmail: row.member_email || row.email || null,
})
