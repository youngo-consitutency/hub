import type { Endpoint } from 'payload'
import { ApiError, endpoint, fail, json, readBody, param } from '../lib/respond'
import { requireVerifiedMember } from '../lib/accounts'
import { audit } from '../lib/audit'
import { AFFILIATION_ROLES, requireOrgScope, seatView } from '../lib/ngo'
import type { Doc } from '../lib/domain'

export const organisationEndpoints: Endpoint[] = [
  {
    path: '/member/organisations',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      const term = String(req.query?.search || '')
        .trim()
        .toLowerCase()
      const { docs } = await req.payload.find({
        collection: 'accounts',
        where: { entityType: { equals: 'organization' } },
        limit: 50,
        sort: 'organizationName',
        overrideAccess: true,
      })
      const items = (docs as Doc[])
        .map((a) => ({
          id: a.id,
          name: a.organizationName || a.name,
          country: a.country || null,
          isUnfcccAdmitted: Boolean(a.isUnfcccAdmitted),
        }))
        .filter((o) =>
          term ? `${o.name || ''} ${o.country || ''}`.toLowerCase().includes(term) : true,
        )
      return json({ items })
    }),
  },
  {
    path: '/member/affiliations',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'ngo-seats',
        where: { memberAccount: { equals: account.id } },
        sort: '-createdAt',
        limit: 50,
        overrideAccess: true,
        depth: 1,
      })
      return json({
        items: (docs as Doc[]).map((s) => ({
          ...seatView(s),
          organizationName: s.orgAccount?.organizationName || s.orgAccount?.name || null,
        })),
      })
    }),
  },
  {
    path: '/member/affiliations',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = await readBody(req)
      const orgAccountId = String(b.orgAccountId || '').trim()
      if (!orgAccountId) throw fail.validation({ orgAccountId: 'Choose an organisation.' })
      const org = (await req.payload.findByID({
        collection: 'accounts',
        id: orgAccountId,
        overrideAccess: true,
        req,
      })) as Doc
      if (!org || org.entityType !== 'organization')
        throw new ApiError(404, 'unknown_organisation', 'Organisation not found.')
      const dup = await req.payload.find({
        collection: 'ngo-seats',
        where: {
          orgAccount: { equals: orgAccountId },
          memberAccount: { equals: account.id },
          status: { in: ['requested', 'active'] },
        },
        limit: 1,
        overrideAccess: true,
      })
      if (dup.docs[0])
        throw new ApiError(
          409,
          'duplicate',
          'You already have a seat or open request with this organisation.',
        )
      const seat = await req.payload.create({
        collection: 'ngo-seats',
        data: {
          orgAccount: Number(orgAccountId),
          memberAccount: account.id,
          email: account.email,
          name: account.name,
          seatRole: 'affiliate',
          status: 'requested',
        },
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'ngo.affiliation_requested',
        targetType: 'ngo_seat',
        targetId: String(seat.id),
        after: { orgAccountId },
      })
      return json({ seat: seatView(seat) }, { status: 201 })
    }),
  },
  {
    path: '/member/affiliations/:id/decide',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, ctx } = await requireOrgScope(req, 'seats')
      const b = await readBody(req)
      const approve = b.decision === 'approve'
      const seatRole = AFFILIATION_ROLES.includes(b.seatRole) ? b.seatRole : 'affiliate'
      const seat = (await req.payload.findByID({
        collection: 'ngo-seats',
        id: param(req, 'id'),
        overrideAccess: true,
        req,
      })) as Doc
      if (!seat) throw fail.notFound('Seat request not found.')
      if (
        String(typeof seat.orgAccount === 'object' ? seat.orgAccount.id : seat.orgAccount) !==
        ctx.orgAccountId
      )
        throw fail.notFound('Seat request not found.')
      if (seat.status !== 'requested')
        throw new ApiError(409, 'conflict', 'This request was already decided.')
      const updated = await req.payload.update({
        collection: 'ngo-seats',
        id: seat.id,
        data: approve
          ? {
              status: 'active',
              seatRole,
              acceptedAt: new Date().toISOString(),
            }
          : { status: 'declined' },
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: approve ? 'ngo.affiliation_approved' : 'ngo.affiliation_declined',
        targetType: 'ngo_seat',
        targetId: String(seat.id),
      })
      return json({ seat: seatView(updated) })
    }),
  },
]
