import type { AnyValue, Doc } from '../lib/domain'
import type { Endpoint } from 'payload'
import { endpoint, fail, json, readBody, param } from '../lib/respond'
import { requireAccount, memberContext } from '../lib/accounts'
import { rateLimit } from '../lib/rateLimit'
import { hasCapability, hasTeamRole } from '../lib/access'
import { trimmed } from '../lib/text'
import { audit } from '../lib/audit'
import { mirrorFeedbackIssue } from '../lib/githubIssues'

const feedbackLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  scope: 'feedback',
})

const TRIAGE_STATUSES = ['new', 'triaged', 'in_progress', 'resolved', 'declined']
// a same-origin path only: no scheme, no protocol-relative host
const PAGE_PATH_RE = /^\/(?!\/)[\w\-/.?=&%]*$/
const VIEWPORT_RE = /^\d{1,5}x\d{1,5}$/

export function feedbackContext(b: AnyValue) {
  const pagePath = trimmed(b.pagePath ?? b.pageUrl, 300)
  const viewport = trimmed(b.viewport, 20)
  return {
    pageUrl: pagePath && PAGE_PATH_RE.test(pagePath) ? pagePath : null,
    viewport: viewport && VIEWPORT_RE.test(viewport) ? viewport : null,
    userAgent: trimmed(b.userAgent, 300) || null,
  }
}

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
      const { access } = await memberContext(req)
      return json({
        kinds: FEEDBACK_KINDS,
        severities: FEEDBACK_SEVERITIES,
        canTriage:
          hasCapability(access, 'accounts.manage') || hasTeamRole(access, 'membership_team'),
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
      let ticket = await req.payload.create({
        collection: 'feedback-tickets',
        data: {
          title,
          kind,
          severity,
          body,
          ...feedbackContext(b),
          contextNote: trimmed(b.contextNote, 200) || null,
          account: account.id,
          contactEmail: account.email,
          status: 'new',
        },
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'feedback.submitted',
        targetType: 'feedback_ticket',
        targetId: String(ticket.id),
        after: { kind, severity },
      })
      const issueUrl = await mirrorFeedbackIssue(ticket, req.payload.logger)
      if (issueUrl) {
        ticket = await req.payload.update({
          collection: 'feedback-tickets',
          id: ticket.id,
          data: { githubIssueUrl: issueUrl },
          overrideAccess: true,
          req,
        })
      }
      return json({ item: ticket }, { status: 201 })
    }),
  },
  {
    path: '/member/feedback',
    method: 'get',
    handler: endpoint(async (req) => {
      const { access } = await memberContext(req)
      const canTriage =
        hasCapability(access, 'accounts.manage') || hasTeamRole(access, 'membership_team')
      if (!canTriage)
        throw fail.forbidden('Feedback triage is for platform operators and the Membership Team.')
      const where: AnyValue = {}
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
      const { account, access } = await memberContext(req)
      const canTriage =
        hasCapability(access, 'accounts.manage') || hasTeamRole(access, 'membership_team')
      if (!canTriage) throw fail.forbidden()
      const b = await readBody(req)
      const data: Doc = {}
      if (b.status !== undefined) {
        if (!TRIAGE_STATUSES.includes(b.status))
          throw fail.validation({ status: 'Unknown status.' })
        data.status = b.status
      }
      if (b.triageNote !== undefined) data.triageNote = trimmed(b.triageNote, 2000)
      if (!Object.keys(data).length) throw fail.validation({ status: 'Nothing to change.' })
      const before = await req.payload
        .findByID({ collection: 'feedback-tickets', id: param(req, 'id'), overrideAccess: true })
        .catch(() => null)
      if (!before) throw fail.notFound()
      const updated = await req.payload.update({
        collection: 'feedback-tickets',
        id: before.id,
        data,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'feedback.triaged',
        targetType: 'feedback_ticket',
        targetId: String(before.id),
        before: { status: before.status },
        after: { status: updated.status, noted: b.triageNote !== undefined },
      })
      return json({ item: updated })
    }),
  },
]
