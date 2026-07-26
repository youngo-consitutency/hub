// NGO organisation portal: service requests, points, seats and invitations.
import { Router } from 'express'
import { requireAccount, requireOrgScope, requireVerified } from './guards.js'
import { getSessionAccount } from '../../lib/accounts.js'
import { recordAudit } from '../../lib/audit.js'
import {
  canManageNgoSeats,
  canWriteNgoRequests,
} from '../../lib/authorization.js'
import { appOrigin } from '../../lib/config.js'
import {
  AFFILIATION_ROLES,
  acceptNgoInvite,
  addNgoRequest,
  decideNgoAffiliation,
  getSeatByToken,
  inviteNgoSeat,
  listMyAffiliations,
  listNgoRequests,
  listNgoSeats,
  listOrganisationsForAffiliation,
  requestNgoAffiliation,
  revokeNgoSeat,
  updateNgoRequestStatus,
} from '../../lib/lifecycle.js'
import {
  POINT_REASONS,
  RECOGNITION_TIERS,
  getOrgPointsBalance,
  listOrgPointsLedger,
  reasonFromNgoRequestKind,
  tiersForBalance,
} from '../../lib/points.js'
import { bearerToken } from '../../lib/security.js'

export const router = Router()

router.get('/ngo/requests', async (req, res) => {
  const account = await requireOrgScope(req, res)
  if (!account) return
  const items = await listNgoRequests(req.orgAccountId)
  const seats = await listNgoSeats(req.orgAccountId)
  const balance = await getOrgPointsBalance(req.orgAccountId)
  const pointsLedger = await listOrgPointsLedger(req.orgAccountId, {
    limit: 25,
  })
  res.json({
    items,
    seats,
    orgAccountId: req.orgAccountId,
    permissions: {
      seatRole: req.orgContext.seatRole,
      canWriteRequests: canWriteNgoRequests(req.orgContext),
      canManageSeats: canManageNgoSeats(req.orgContext),
    },
    points: {
      balance,
      recognition: tiersForBalance(balance),
      ledger: pointsLedger,
      tiers: RECOGNITION_TIERS,
      reasons: Object.values(POINT_REASONS).filter(
        (r) => r.code !== 'adjustment',
      ),
    },
    deadlines: [
      {
        title: 'Side event applications (placeholder)',
        kind: 'deadline',
        note: 'Connect live UNFCCC calendars later.',
      },
      {
        title: 'COP/SB nomination windows (placeholder)',
        kind: 'deadline',
        note: 'Membership Team will publish real dates.',
      },
      {
        title: 'Submission deadlines tracked in hub Submissions',
        kind: 'deadline',
        href: '/submissions',
      },
    ],
  })
})

router.get('/ngo/points', async (req, res) => {
  const account = await requireOrgScope(req, res)
  if (!account) return
  const balance = await getOrgPointsBalance(req.orgAccountId)
  const ledger = await listOrgPointsLedger(req.orgAccountId, {
    limit: Number(req.query.limit) || 50,
  })
  res.json({
    orgAccountId: req.orgAccountId,
    balance,
    recognition: tiersForBalance(balance),
    ledger,
    tiers: RECOGNITION_TIERS,
    reasons: Object.values(POINT_REASONS),
  })
})

router.post('/ngo/requests', async (req, res) => {
  const account = await requireOrgScope(req, res, 'requests')
  if (!account) return
  const b = req.body || {}
  if (!b.title || !b.kind) {
    return res.status(400).json({
      error: { code: 'validation', message: 'title and kind required.' },
    })
  }
  const item = await addNgoRequest({
    orgAccountId: req.orgAccountId,
    kind: b.kind,
    title: String(b.title).slice(0, 200),
    body: b.body || null,
    deadlineAt: b.deadlineAt || null,
    createdBy: account.id,
  })
  await recordAudit({
    actorId: account.id,
    action: 'ngo.request_created',
    targetType: 'ngo_request',
    targetId: item.id,
    after: item,
    requestId: req.requestId,
  })
  res.status(201).json({ item })
})

router.patch('/ngo/requests/:id', async (req, res) => {
  const account = await requireOrgScope(req, res, 'requests')
  if (!account) return
  const nextStatus = String(req.body?.status || 'done')
  if (!['open', 'in_progress', 'done', 'declined'].includes(nextStatus)) {
    return res.status(400).json({
      error: { code: 'validation', message: 'Invalid request status.' },
    })
  }
  const item = await updateNgoRequestStatus(
    req.params.id,
    nextStatus,
    req.orgAccountId,
  )
  if (!item)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Request not found.' } })
  await recordAudit({
    actorId: account.id,
    action: 'ngo.request_status_changed',
    targetType: 'ngo_request',
    targetId: item.id,
    after: item,
    reason: req.body?.reason,
    requestId: req.requestId,
  })
  // When marked done, surface a staff award suggestion (points stay human-verified).
  let awardSuggestion = null
  if (nextStatus === 'done') {
    const reasonCode = reasonFromNgoRequestKind(item.kind)
    const reason = POINT_REASONS[reasonCode] || POINT_REASONS.other
    awardSuggestion = {
      requestId: item.id,
      orgAccountId: req.orgAccountId,
      kind: item.kind,
      title: item.title,
      suggestedReasonCode: reasonCode,
      suggestedReasonLabel: reason.label,
      suggestedPoints: reason.defaultPoints,
      message:
        'Request marked done. Staff can award contribution points from /staff/points.',
    }
  }
  res.json({ item, awardSuggestion })
})

router.get('/ngo/seats', async (req, res) => {
  const account = await requireOrgScope(req, res)
  if (!account) return
  const seats = await listNgoSeats(req.orgAccountId)
  res.json({ seats, orgAccountId: req.orgAccountId })
})

router.post('/ngo/seats/invite', async (req, res) => {
  const account = await requireOrgScope(req, res, 'seats')
  if (!account) return
  try {
    const result = await inviteNgoSeat({
      orgAccountId: req.orgAccountId,
      email: req.body?.email,
      name: req.body?.name,
      seatRole: req.body?.seatRole || 'representative',
      invitedBy: account.id,
    })
    const inviteUrl = result.inviteToken
      ? `${appOrigin()}/ngo/accept?token=${result.inviteToken}`
      : null
    await recordAudit({
      actorId: account.id,
      action: 'ngo.seat_invited',
      targetType: 'ngo_seat',
      targetId: result.seat.id,
      after: result.seat,
      requestId: req.requestId,
    })
    res.status(201).json({
      seat: result.seat,
      inviteUrl,
      note: 'Share this one-time link with the invited representative. It expires in 7 days.',
    })
  } catch (err) {
    const status = err.code === 'duplicate' ? 409 : 400
    res
      .status(status)
      .json({ error: { code: err.code || 'validation', message: err.message } })
  }
})

router.post('/ngo/seats/:id/revoke', async (req, res) => {
  const account = await requireOrgScope(req, res, 'seats')
  if (!account) return
  const seat = await revokeNgoSeat(req.params.id, req.orgAccountId)
  if (!seat) {
    return res.status(400).json({
      error: {
        code: 'cannot_revoke',
        message: 'Cannot revoke owner or missing seat.',
      },
    })
  }
  await recordAudit({
    actorId: account.id,
    action: 'ngo.seat_revoked',
    targetType: 'ngo_seat',
    targetId: seat.id,
    after: seat,
    reason: req.body?.reason,
    requestId: req.requestId,
  })
  res.json({ seat })
})

router.get('/ngo/invite/:token', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  const seat = await getSeatByToken(req.params.token, account.email)
  if (!seat) {
    return res.status(404).json({
      error: {
        code: 'not_found',
        message: 'Invite not found or already used.',
      },
    })
  }
  res.json({ seat })
})

router.post('/ngo/invite/:token/accept', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  try {
    const seat = await acceptNgoInvite(req.params.token, account)
    if (!seat) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Invite not found or already used.',
        },
      })
    }
    await recordAudit({
      actorId: account.id,
      action: 'ngo.seat_accepted',
      targetType: 'ngo_seat',
      targetId: seat.id,
      after: seat,
      requestId: req.requestId,
    })
    const refreshedAccount = await getSessionAccount(bearerToken(req))
    res.json({ ok: true, seat, account: refreshedAccount })
  } catch (err) {
    console.error('accept invite failed:', err.message)
    res.status(500).json({
      error: { code: 'server_error', message: 'Could not accept invite.' },
    })
  }
})

/* ── Affiliation: a member asks, the organisation decides ───────────── */

/** Organisations a member can pick from. Any verified member may browse. */
router.get('/organisations', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  const items = await listOrganisationsForAffiliation(req.query.search || '')
  res.json({ items })
})

/** The member's own affiliations, including requests awaiting a decision. */
router.get('/affiliations', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  const items = await listMyAffiliations(account.id)
  res.json({ items })
})

router.post('/affiliations', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  const orgAccountId = String(req.body?.orgAccountId || '').trim()
  if (!orgAccountId) {
    return res.status(400).json({
      error: { code: 'validation', message: 'Choose an organisation.' },
    })
  }
  try {
    const seat = await requestNgoAffiliation({ account, orgAccountId })
    await recordAudit({
      actorId: account.id,
      action: 'ngo.affiliation_requested',
      targetType: 'ngo_seat',
      targetId: seat.id,
      after: { orgAccountId, status: seat.status },
      requestId: req.requestId,
    })
    res.status(201).json({ seat })
  } catch (error) {
    if (error.code === 'unknown_organisation') {
      return res
        .status(404)
        .json({ error: { code: error.code, message: error.message } })
    }
    throw error
  }
})

/**
 * Approve or decline a request. The organisation chooses what the link grants:
 * 'affiliate' records the association only, while viewer and representative
 * also open the organisation's portal.
 */
router.post('/affiliations/:id/decide', async (req, res) => {
  const account = await requireOrgScope(req, res, 'seats')
  if (!account) return
  const approve = req.body?.decision === 'approve'
  const seatRole = String(req.body?.seatRole || 'affiliate')
  if (approve && !AFFILIATION_ROLES.includes(seatRole)) {
    return res.status(400).json({
      error: {
        code: 'validation',
        message: `Seat role must be one of: ${AFFILIATION_ROLES.join(', ')}.`,
      },
    })
  }
  const seat = await decideNgoAffiliation({
    seatId: req.params.id,
    orgAccountId: req.orgAccountId,
    approve,
    seatRole,
  })
  if (!seat) {
    return res.status(404).json({
      error: {
        code: 'not_found',
        message: 'That request is no longer awaiting a decision.',
      },
    })
  }
  await recordAudit({
    actorId: account.id,
    action: approve ? 'ngo.affiliation_approved' : 'ngo.affiliation_declined',
    targetType: 'ngo_seat',
    targetId: seat.id,
    after: { status: seat.status, seatRole: approve ? seatRole : null },
    requestId: req.requestId,
  })
  res.json({ seat })
})
