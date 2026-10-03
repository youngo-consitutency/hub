import type { Endpoint } from 'payload'
import { ApiError, endpoint, fail, json, readBody, param } from '../lib/respond'
import { accountView, requirePlatformOperator, requireVerifiedMember } from '../lib/accounts'
import { audit } from '../lib/audit'
import { getAccessProfile, canManageWg } from '../lib/access'
import { wgActivityView } from '../lib/views'
import { getDocument } from '../lib/documents'
import { TASK_FORCE_SLUGS } from '../../spa/shared/protocol.js'

function publicSlot(s: any) {
  return {
    id: s.id,
    startsAt: s.startsAt,
    durationMinutes: s.durationMinutes,
    meetUrl: s.meetUrl || null,
    host:
      s.host && typeof s.host === 'object'
        ? { id: s.host.id, name: s.host.name, email: s.host.email }
        : null,
    bookedBy:
      s.bookedBy && typeof s.bookedBy === 'object'
        ? { id: s.bookedBy.id, name: s.bookedBy.name, email: s.bookedBy.email }
        : null,
    bookedAt: s.bookedAt || null,
  }
}

export const contactPointEndpoints: Endpoint[] = [
  // ── Contact point (WG management) ─────────────────────────────────
  {
    path: '/member/cp/:wg/members',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const wg = param(req, 'wg')
      const access = await getAccessProfile(req, account)
      if (!canManageWg(access, wg))
        throw fail.forbidden('You are not a contact point for this working group.')
      const { docs } = await req.payload.find({
        collection: 'wg-progress',
        where: { wgSlug: { equals: wg } },
        sort: '-joinedAt',
        limit: 500,
        overrideAccess: true,
        depth: 1,
      })
      return json({
        members: (docs as any[]).map((d) => ({
          progress: {
            wg_slug: d.wgSlug,
            status: d.status,
            role_in_wg: d.roleInWg,
            joined_at: d.joinedAt,
            presentation_ok: d.presentationOk,
            rules_ok: d.rulesOk,
            unlocked_at: d.unlockedAt,
          },
          account: d.account && typeof d.account === 'object' ? accountView(d.account) : null,
        })),
      })
    }),
  },
  {
    path: '/member/cp/:wg/members/:accountId/role',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const wg = param(req, 'wg')
      const access = await getAccessProfile(req, account)
      if (!canManageWg(access, wg)) throw fail.forbidden()
      const accountId = param(req, 'accountId')
      const b = await readBody(req)
      const roleInWg = ['member', 'contact_point', 'observer'].includes(b.roleInWg)
        ? b.roleInWg
        : 'member'
      const { docs } = await req.payload.find({
        collection: 'wg-progress',
        where: { wgSlug: { equals: wg }, account: { equals: accountId } },
        limit: 1,
        overrideAccess: true,
      })
      if (!docs[0]) throw fail.notFound()
      const updated = await req.payload.update({
        collection: 'wg-progress',
        id: (docs[0] as any).id,
        data: { roleInWg } as any,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'wg.role_update',
        targetType: 'wg_progress',
        targetId: String((docs[0] as any).id),
        after: { wg, roleInWg },
      })
      return json({ progress: updated })
    }),
  },
  {
    path: '/member/cp/:wg/activities',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const wg = param(req, 'wg')
      const access = await getAccessProfile(req, account)
      if (!canManageWg(access, wg)) throw fail.forbidden()
      const { docs } = await req.payload.find({
        collection: 'wg-activities',
        where: { wgSlug: { equals: wg } },
        sort: '-createdAt',
        limit: 50,
        overrideAccess: true,
      })
      return json({ items: (docs as any[]).map(wgActivityView) })
    }),
  },
  {
    path: '/member/cp/:wg/activities',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const wg = param(req, 'wg')
      const access = await getAccessProfile(req, account)
      if (!canManageWg(access, wg)) throw fail.forbidden()
      const b = await readBody(req)
      const title = String(b.title || '')
        .trim()
        .slice(0, 200)
      if (!title || !b.kind) throw fail.validation({ title: 'title and kind are required.' })
      const options = await getDocument(req, 'content-options')
      const kinds = (options?.body?.wgActivityKinds || []).map((k: any) => String(k.value))
      if (!kinds.includes(String(b.kind)))
        throw new ApiError(400, 'validation', 'Invalid activity kind.')
      if (b.startsAt && Number.isNaN(Date.parse(b.startsAt)))
        throw new ApiError(400, 'validation', 'Invalid start date.')
      const taskForceSlug = b.taskForceSlug ? String(b.taskForceSlug) : null
      if (taskForceSlug && !TASK_FORCE_SLUGS.has(taskForceSlug))
        throw new ApiError(400, 'validation', 'Unknown task force.')
      if (b.url && !/^https?:\/\//.test(String(b.url)))
        throw fail.validation({
          url: 'Link must be a full http:// or https:// URL.',
        })
      const created = await req.payload.create({
        collection: 'wg-activities',
        data: {
          wgSlug: wg,
          kind: String(b.kind),
          title,
          body: b.body ? String(b.body).slice(0, 2000) : null,
          startsAt: b.startsAt || null,
          endsAt: b.endsAt || null,
          url: b.url ? String(b.url) : null,
          taskForceSlug,
          createdBy: account.id,
        } as any,
        overrideAccess: true,
        req,
      })
      const activity = wgActivityView(created)
      await audit(req, account, {
        action: 'wg.activity_created',
        targetType: 'wg_activity',
        targetId: String(created.id),
        after: activity,
      })
      return json({ activity }, { status: 201 })
    }),
  },
  {
    path: '/member/cp/:wg/public-space',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const wg = param(req, 'wg')
      const access = await getAccessProfile(req, account)
      if (!canManageWg(access, wg)) throw fail.forbidden()
      const b = await readBody(req)
      const { docs } = await req.payload.find({
        collection: 'working-groups',
        where: { slug: { equals: wg } },
        limit: 1,
        overrideAccess: true,
      })
      if (!docs[0]) throw fail.notFound('Unknown working group.')
      const data: any = { publicSpace: Boolean(b.publicSpace) }
      const updated = await req.payload.update({
        collection: 'working-groups',
        id: (docs[0] as any).id,
        data,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'wg.public_space',
        targetType: 'working_group',
        targetId: String((docs[0] as any).id),
        after: { wg, publicSpace: data.publicSpace },
      })
      return json({ group: updated })
    }),
  },

  // ── CP calls ──────────────────────────────────────────────────────
  {
    path: '/member/cp-calls/slots',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'cp-call-slots',
        where: {
          startsAt: { greater_than: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
        },
        sort: 'startsAt',
        limit: 100,
        overrideAccess: true,
        depth: 1,
      })
      const slots = docs as any[]
      return json({
        slots: slots
          .filter(
            (s) => !s.bookedBy || typeof s.bookedBy !== 'object' || s.bookedBy.id !== account.id,
          )
          .map(publicSlot),
        mine: slots
          .filter(
            (s) =>
              s.bookedBy &&
              typeof s.bookedBy === 'object' &&
              String(s.bookedBy.id) === String(account.id),
          )
          .map(publicSlot),
      })
    }),
  },
  {
    path: '/member/cp-calls/slots/:id/book',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const id = param(req, 'id')
      const slot = (await req.payload.findByID({
        collection: 'cp-call-slots',
        id,
        overrideAccess: true,
        req,
      })) as any
      if (!slot) throw fail.notFound()
      if (slot.bookedBy) throw new ApiError(409, 'conflict', 'This slot was already booked.')
      if (Date.parse(slot.startsAt) < Date.now())
        throw fail.validation({ startsAt: 'This slot is in the past.' })
      const updated = await req.payload.update({
        collection: 'cp-call-slots',
        id,
        data: { bookedBy: account.id, bookedAt: new Date().toISOString() } as any,
        overrideAccess: true,
        req,
      })
      return json({ slot: updated }, { status: 201 })
    }),
  },
  {
    path: '/member/cp-calls/mine/cancel',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = await readBody(req)
      const id = String(b.slotId || '')
      const slot = (await req.payload.findByID({
        collection: 'cp-call-slots',
        id,
        overrideAccess: true,
        req,
      })) as any
      if (!slot) throw fail.notFound()
      const bookedById = typeof slot.bookedBy === 'object' ? slot.bookedBy.id : slot.bookedBy
      if (String(bookedById) !== String(account.id)) throw fail.forbidden()
      const released = await req.payload.update({
        collection: 'cp-call-slots',
        id,
        data: { bookedBy: null, bookedAt: null } as any,
        overrideAccess: true,
        req,
      })
      return json({ released })
    }),
  },
  {
    path: '/member/admin/cp-calls',
    method: 'get',
    handler: endpoint(async (req) => {
      await requirePlatformOperator(req)
      const { docs } = await req.payload.find({
        collection: 'cp-call-slots',
        sort: 'startsAt',
        limit: 200,
        overrideAccess: true,
        depth: 1,
      })
      return json({ slots: (docs as any[]).map(publicSlot) })
    }),
  },
  {
    path: '/member/admin/cp-calls/mine',
    method: 'get',
    handler: endpoint(async (req) => {
      const { account } = await requirePlatformOperator(req)
      const { docs } = await req.payload.find({
        collection: 'cp-call-slots',
        where: { host: { equals: account.id } },
        sort: 'startsAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({ slots: (docs as any[]).map(publicSlot) })
    }),
  },
  {
    path: '/member/admin/cp-calls',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account } = await requirePlatformOperator(req)
      const b = await readBody(req)
      const slots = Array.isArray(b.slots) ? b.slots : [b]
      const created: any[] = []
      for (const s of slots) {
        const startsAt = Date.parse(s.startsAt)
        const duration = Number(s.durationMinutes || 30)
        if (!Number.isFinite(startsAt) || startsAt < Date.now())
          throw fail.validation({ startsAt: 'Each slot needs a future start time.' })
        if (duration < 10 || duration > 240)
          throw fail.validation({ durationMinutes: 'Duration must be 10–240 minutes.' })
        created.push(
          await req.payload.create({
            collection: 'cp-call-slots',
            data: {
              startsAt: new Date(startsAt).toISOString(),
              durationMinutes: duration,
              host: account.id,
              meetUrl: String(s.meetUrl || '').slice(0, 500) || null,
            } as any,
            overrideAccess: true,
            req,
          }),
        )
      }
      return json({ slots: created }, { status: 201 })
    }),
  },
  {
    path: '/member/admin/cp-calls/:id/cancel',
    method: 'post',
    handler: endpoint(async (req) => {
      await requirePlatformOperator(req)
      const id = param(req, 'id')
      const slot = (await req.payload.findByID({
        collection: 'cp-call-slots',
        id,
        overrideAccess: true,
        req,
      })) as any
      if (!slot) throw fail.notFound()
      await req.payload.delete({
        collection: 'cp-call-slots',
        id,
        overrideAccess: true,
        req,
      })
      return json({ cancelled: true })
    }),
  },
]
