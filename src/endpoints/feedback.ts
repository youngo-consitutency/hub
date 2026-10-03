import type { Endpoint } from 'payload'
import { endpoint, fail, json, readBody, param } from '../lib/respond'
import { requireAccount } from '../lib/accounts'
import { getAccessProfile } from '../lib/access'
import { rateLimit } from '../lib/rateLimit'
import { trimmed } from '../lib/text'

const feedbackLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  scope: 'feedback',
})

const FEEDBACK_KINDS = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'ui_ux', label: 'Design or usability' },
  { value: 'feature', label: 'Feature idea' },
  { value: 'blocker', label: 'I am blocked' },
  { value: 'content', label: 'Wrong or missing content' },
  { value: 'other', label: 'Something else' },
]
const FEEDBACK_SEVERITIES = [
  { value: 'low', label: 'Minor' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Serious' },
  { value: 'critical', label: 'Cannot use the Hub' },
]

export const feedbackEndpoints: Endpoint[] = [
  // ── Feedback ──────────────────────────────────────────────────────
  {
    path: '/member/feedback/options',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const access = await getAccessProfile(req, account)
      return json({
        kinds: FEEDBACK_KINDS,
        severities: FEEDBACK_SEVERITIES,
        canTriage:
          access.capabilities.includes('accounts.manage') ||
          access.teamRoles.includes('membership_team'),
      })
    }),
  },
  {
    path: '/member/feedback/mine',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const { docs } = await req.payload.find({
        collection: 'feedback-tickets',
        where: { account: { equals: account.id } },
        sort: '-createdAt',
        limit: 100,
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/feedback',
    method: 'post',
    handler: endpoint(async (req) => {
      await feedbackLimit(req)
      const account = requireAccount(req)
      const b = await readBody(req)
      const title = trimmed(b.title, 200)
      const kind = FEEDBACK_KINDS.some((k) => k.value === b.kind) ? b.kind : null
      const severity = FEEDBACK_SEVERITIES.some((s) => s.value === b.severity)
        ? b.severity
        : 'normal'
      const body = trimmed(b.body, 5000)
      if (!title || !kind || !body) {
        throw fail.validation({
          ...(title ? {} : { title: 'Please describe the issue briefly.' }),
          ...(kind ? {} : { kind: 'Pick what this is about.' }),
          ...(body ? {} : { body: 'Tell us what happened.' }),
        })
      }
      const ticket = await req.payload.create({
        collection: 'feedback-tickets',
        data: {
          title,
          kind,
          severity,
          body,
          pageUrl: trimmed(b.pageUrl, 500) || null,
          contextNote: trimmed(b.contextNote, 200) || null,
          account: account.id,
          contactEmail: account.email,
          status: 'new',
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: ticket }, { status: 201 })
    }),
  },
  {
    path: '/member/feedback',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const access = await getAccessProfile(req, account)
      const canTriage =
        access.capabilities.includes('accounts.manage') ||
        access.teamRoles.includes('membership_team')
      if (!canTriage)
        throw fail.forbidden('Feedback triage is for platform operators and the Membership Team.')
      const where: any = {}
      if (req.query?.status) where.status = { equals: req.query.status }
      if (req.query?.kind) where.kind = { equals: req.query.kind }
      const { docs } = await req.payload.find({
        collection: 'feedback-tickets',
        where,
        sort: '-createdAt',
        limit: Math.min(200, Number(req.query?.limit || 100)),
        overrideAccess: true,
      })
      return json({ items: docs })
    }),
  },
  {
    path: '/member/feedback/:id',
    method: 'patch',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const access = await getAccessProfile(req, account)
      const canTriage =
        access.capabilities.includes('accounts.manage') ||
        access.teamRoles.includes('membership_team')
      if (!canTriage) throw fail.forbidden()
      const b = await readBody(req)
      const data: any = {}
      if (b.status && ['new', 'triaged', 'in_progress', 'resolved', 'declined'].includes(b.status))
        data.status = b.status
      if (b.triageNote !== undefined) data.triageNote = trimmed(b.triageNote, 2000)
      const updated = await req.payload.update({
        collection: 'feedback-tickets',
        id: param(req, 'id'),
        data,
        overrideAccess: true,
        req,
      })
      return json({ item: updated })
    }),
  },
]
