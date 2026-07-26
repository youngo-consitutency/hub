// Staff console for awarding NGO contribution points.
import { Router } from 'express'
import { requireAccount } from './guards.js'
import { recordAudit } from '../../lib/audit.js'
import {
  POINT_REASONS,
  RECOGNITION_TIERS,
  awardOrgPoints,
  canAwardPoints,
  listAwardSuggestions,
  listOrgPointBalances,
  listRecentPointAwards,
  reasonFromNgoRequestKind,
} from '../../lib/points.js'

export const router = Router()

async function requirePointsAwarder(req, res) {
  const account = await requireAccount(req, res)
  if (!account) return null
  if (!(await canAwardPoints(account))) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message:
          'Only admins, Focal Points, or Membership Team can award NGO contribution points.',
      },
    })
    return null
  }
  return account
}

router.get('/staff/points', async (req, res) => {
  const account = await requirePointsAwarder(req, res)
  if (!account) return
  const [orgs, recent, suggestions] = await Promise.all([
    listOrgPointBalances(),
    listRecentPointAwards({ limit: 40 }),
    listAwardSuggestions({ limit: 40 }),
  ])
  res.json({
    orgs,
    recent,
    suggestions,
    reasons: Object.values(POINT_REASONS),
    tiers: RECOGNITION_TIERS,
    defaults: Object.fromEntries(
      Object.values(POINT_REASONS).map((r) => [r.code, r.defaultPoints]),
    ),
  })
})

router.post('/staff/points/award', async (req, res) => {
  const account = await requirePointsAwarder(req, res)
  if (!account) return
  const b = req.body || {}
  try {
    const result = await awardOrgPoints({
      orgAccountId: b.orgAccountId,
      points: b.points,
      reasonCode: b.reasonCode,
      title: b.title,
      note: b.note,
      relatedType: b.relatedType || (b.requestId ? 'ngo_request' : null),
      relatedId: b.relatedId || b.requestId || null,
      awardedBy: account.id,
    })
    await recordAudit({
      actorId: account.id,
      action: 'ngo.points_awarded',
      targetType: 'ngo_points',
      targetId: result.entry.id,
      after: result,
      reason: b.note || null,
      requestId: req.requestId,
    })
    res.status(201).json(result)
  } catch (err) {
    const status = err.code === 'not_found' ? 404 : 400
    res
      .status(status)
      .json({ error: { code: err.code || 'validation', message: err.message } })
  }
})

/** One-click award from a done NGO request suggestion. */

router.post('/staff/points/award-suggestion', async (req, res) => {
  const account = await requirePointsAwarder(req, res)
  if (!account) return
  const b = req.body || {}
  if (!b.requestId || !b.orgAccountId) {
    return res.status(400).json({
      error: {
        code: 'validation',
        message: 'requestId and orgAccountId required.',
      },
    })
  }
  try {
    const reasonCode =
      b.reasonCode || reasonFromNgoRequestKind(b.kind || 'other')
    const reason = POINT_REASONS[reasonCode] || POINT_REASONS.other
    const result = await awardOrgPoints({
      orgAccountId: b.orgAccountId,
      points: b.points ?? reason.defaultPoints,
      reasonCode,
      title: b.title || reason.label,
      note: b.note || 'Awarded from completed NGO request',
      relatedType: 'ngo_request',
      relatedId: String(b.requestId),
      awardedBy: account.id,
    })
    await recordAudit({
      actorId: account.id,
      action: 'ngo.points_awarded_from_request',
      targetType: 'ngo_request',
      targetId: String(b.requestId),
      after: result,
      requestId: req.requestId,
    })
    res.status(201).json(result)
  } catch (err) {
    const status = err.code === 'not_found' ? 404 : 400
    res
      .status(status)
      .json({ error: { code: err.code || 'validation', message: err.message } })
  }
})

router.get('/staff/points/reasons', async (req, res) => {
  const account = await requirePointsAwarder(req, res)
  if (!account) return
  res.json({
    reasons: Object.values(POINT_REASONS),
    fromRequestKind: {
      endorse: reasonFromNgoRequestKind('endorse'),
      submit: reasonFromNgoRequestKind('submit'),
      represent: reasonFromNgoRequestKind('represent'),
    },
  })
})
