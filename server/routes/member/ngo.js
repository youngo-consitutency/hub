// NGO organisation portal: service requests, points, seats and invitations.
import { Router } from 'express'
import { requireAccount, requireVerified } from './guards.js'
import { getSessionAccount } from '../../lib/accounts.js'
import { recordAudit } from '../../lib/audit.js'
import {
  canManageNgoSeats,
  canWriteNgoRequests,
} from '../../lib/authorization.js'
import { appOrigin } from '../../lib/config.js'
import {
  acceptNgoInvite,
  addNgoRequest,
  getSeatByToken,
  inviteNgoSeat,
  listNgoRequests,
  listNgoSeats,
  resolveOrgContext,
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

async function requireOrgScope(req, res, permission = 'read') {
  const account = await requireAccount(req, res)
  if (!account) return null
  if (!requireVerified(req, res)) return null
  const requestedOrgId = req.query.orgId || req.body?.orgId || null
  const context = await resolveOrgContext(account, requestedOrgId)
  if (!context) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Accredited NGO access required.',
      },
    })
    return null
  }
  if (permission === 'requests' && !context.canManageRequests) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Viewer seats have read-only access.',
      },
    })
    return null
  }
  if (permission === 'seats' && !context.canManageSeats) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Only the organization owner may manage seats.',
      },
    })
    return null
  }
  req.orgAccountId = context.orgAccountId
  req.orgContext = context
  return account
}

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
