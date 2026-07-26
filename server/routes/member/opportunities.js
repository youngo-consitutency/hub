// NGO postings — events, online workshops, hackathons, opportunities.
//
// Three audiences: organisations post and withdraw their own, verified members
// browse what is published, and staff clear the review queue.
import { Router } from 'express'
import { requireAccount, requireOrgScope, requireVerified } from './guards.js'
import { recordAudit } from '../../lib/audit.js'
import {
  OPPORTUNITY_FORMATS,
  OPPORTUNITY_KINDS,
  createOpportunity,
  listOrgOpportunities,
  listPendingOpportunities,
  listPostingOrganisations,
  listPublishedForStaff,
  listPublishedOpportunities,
  normalizeOpportunityInput,
  orgPostingTrust,
  reviewOpportunity,
  setOrgPostingTrust,
  unpublishOpportunity,
  withdrawOpportunity,
} from '../../lib/opportunities.js'

export const router = Router()

function canReview(account) {
  return (
    account.role === 'admin' ||
    account.access?.teamRoles?.includes('membership_team')
  )
}

function forbidReview(res) {
  res.status(403).json({
    error: {
      code: 'forbidden',
      message: 'Posting review is for admins and the Membership Team.',
    },
  })
}

/* ── Members: the board ─────────────────────────────────────────────── */

router.get('/opportunities', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  res.json({
    items: await listPublishedOpportunities({
      kind: req.query.kind,
      format: req.query.format,
    }),
    kinds: OPPORTUNITY_KINDS,
    formats: OPPORTUNITY_FORMATS,
  })
})

/* ── Organisations: their own postings ──────────────────────────────── */

router.get('/ngo/opportunities', async (req, res) => {
  const account = await requireOrgScope(req, res)
  if (!account) return
  res.json({
    items: await listOrgOpportunities(req.orgAccountId),
    trusted: await orgPostingTrust(req.orgAccountId),
    kinds: OPPORTUNITY_KINDS,
    formats: OPPORTUNITY_FORMATS,
    canPost: Boolean(req.orgContext.canManageRequests),
  })
})

router.post('/ngo/opportunities', async (req, res) => {
  const account = await requireOrgScope(req, res, 'requests')
  if (!account) return
  let input
  try {
    input = normalizeOpportunityInput(req.body)
  } catch (error) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: error.message } })
  }
  const item = await createOpportunity(input, {
    orgAccountId: req.orgAccountId,
    createdBy: account.id,
  })
  await recordAudit({
    actorId: account.id,
    action: 'ngo.opportunity_created',
    targetType: 'ngo_opportunity',
    targetId: item.id,
    after: { kind: item.kind, status: item.status },
    requestId: req.requestId,
  })
  res.status(201).json({
    item,
    note:
      item.status === 'published'
        ? 'Published to the constituency.'
        : 'Sent for review. Your organisation posts directly once this first one is approved.',
  })
})

router.post('/ngo/opportunities/:id/withdraw', async (req, res) => {
  const account = await requireOrgScope(req, res, 'requests')
  if (!account) return
  const item = await withdrawOpportunity(req.params.id, req.orgAccountId)
  if (!item) {
    return res.status(404).json({
      error: { code: 'not_found', message: 'That posting is not live.' },
    })
  }
  await recordAudit({
    actorId: account.id,
    action: 'ngo.opportunity_withdrawn',
    targetType: 'ngo_opportunity',
    targetId: item.id,
    after: { status: item.status },
    requestId: req.requestId,
  })
  res.json({ item })
})

/* ── Staff: the review queue ────────────────────────────────────────── */

router.get('/opportunities/review', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!canReview(account)) return forbidReview(res)
  const [items, published, organisations] = await Promise.all([
    listPendingOpportunities(),
    listPublishedForStaff(),
    listPostingOrganisations(),
  ])
  res.json({ items, published, organisations })
})

router.post('/opportunities/:id/review', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!canReview(account)) return forbidReview(res)
  const approve = req.body?.decision === 'approve'
  let item
  try {
    item = await reviewOpportunity(req.params.id, {
      approve,
      note: req.body?.note,
      reviewerId: account.id,
    })
  } catch (error) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: error.message } })
  }
  if (!item) {
    return res.status(404).json({
      error: {
        code: 'not_found',
        message: 'That posting is no longer awaiting review.',
      },
    })
  }
  await recordAudit({
    actorId: account.id,
    action: approve ? 'ngo.opportunity_approved' : 'ngo.opportunity_rejected',
    targetType: 'ngo_opportunity',
    targetId: item.id,
    after: { status: item.status },
    reason: req.body?.note,
    requestId: req.requestId,
  })
  res.json({ item })
})

router.post('/opportunities/:id/unpublish', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!canReview(account)) return forbidReview(res)
  let item
  try {
    item = await unpublishOpportunity(req.params.id, {
      note: req.body?.note,
      reviewerId: account.id,
    })
  } catch (error) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: error.message } })
  }
  if (!item) {
    return res.status(404).json({
      error: { code: 'not_found', message: 'That posting is not published.' },
    })
  }
  await recordAudit({
    actorId: account.id,
    action: 'ngo.opportunity_unpublished',
    targetType: 'ngo_opportunity',
    targetId: item.id,
    after: { status: item.status },
    reason: req.body?.note,
    requestId: req.requestId,
  })
  res.json({ item })
})

/**
 * Put an organisation back into review, or pre-approve a known partner.
 * Overrides the default "trusted after one approved posting" derivation.
 */
router.post('/opportunities/trust/:orgAccountId', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!canReview(account)) return forbidReview(res)
  let result
  try {
    result = await setOrgPostingTrust(
      req.params.orgAccountId,
      req.body?.state,
      account.id,
      req.body?.note,
    )
  } catch (error) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: error.message } })
  }
  await recordAudit({
    actorId: account.id,
    action: 'ngo.opportunity_trust_set',
    targetType: 'hub_account',
    targetId: req.params.orgAccountId,
    after: result,
    reason: req.body?.note,
    requestId: req.requestId,
  })
  res.json(result)
})
