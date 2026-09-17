import { findAccountById } from '../../lib/accounts.js'
// Working-group contact-point console: roster and activity management.
import { Router } from 'express'
import { requireAccount, requireVerified } from './guards.js'
import { WG_ACTIVITY_KIND_VALUES } from '../../../shared/workflows.js'
import { canManageWg } from '../../lib/access.js'
import { recordAudit } from '../../lib/audit.js'
import {
  addWgActivity,
  getWgProgress,
  listWgJoiners,
  upsertWgProgress,
} from '../../lib/lifecycle.js'

export const router = Router()

async function requireWgManager(req, res) {
  const account = await requireAccount(req, res)
  if (!account) return null
  if (!requireVerified(req, res)) return null
  if (!(await canManageWg(account, req.params.wg))) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Contact Point access for this working group is required.',
      },
    })
    return null
  }
  return account
}

router.get('/cp/:wg/members', async (req, res) => {
  const account = await requireWgManager(req, res)
  if (!account) return
  const items = await listWgJoiners(req.params.wg)
  res.json({ items })
})

router.post('/cp/:wg/members/:accountId/role', async (req, res) => {
  const account = await requireWgManager(req, res)
  if (!account) return
  const role = String(req.body?.role || 'member')
  const status = String(req.body?.status || 'active')
  if (
    role !== 'member' ||
    !['interested', 'pending_approval', 'active', 'rejected'].includes(status)
  ) {
    return res.status(400).json({
      error: {
        code: 'validation',
        message:
          'Use a membership status here. Contact Point appointments must be recorded with evidence in Bodies & mandates.',
      },
    })
  }
  const before = await getWgProgress(req.params.accountId, req.params.wg)
  if (!before && account.role !== 'admin') {
    return res.status(404).json({
      error: {
        code: 'not_found',
        message: 'This person has not joined the working group.',
      },
    })
  }
  const target = await findAccountById(req.params.accountId)
  if (
    (before && ['contact', 'lead'].includes(before.role_in_wg)) ||
    (target && (await canManageWg(target, req.params.wg)))
  ) {
    return res.status(409).json({
      error: {
        code: 'conflict',
        message:
          'Manage this mandate through its assignment record, not the membership queue.',
      },
    })
  }
  const progress = await upsertWgProgress(req.params.accountId, req.params.wg, {
    role_in_wg: role,
    status,
  })
  await recordAudit({
    actorId: account.id,
    action: 'wg.member_role_changed',
    targetType: 'wg_membership',
    targetId: `${req.params.wg}:${req.params.accountId}`,
    before,
    after: { role, status },
    reason: req.body?.reason,
    requestId: req.requestId,
  })
  res.json({ progress })
})

router.post('/cp/:wg/activities', async (req, res) => {
  const account = await requireWgManager(req, res)
  if (!account) return
  const b = req.body || {}
  if (!b.title || !b.kind) {
    return res.status(400).json({
      error: { code: 'validation', message: 'title and kind are required.' },
    })
  }
  if (!WG_ACTIVITY_KIND_VALUES.includes(String(b.kind))) {
    return res.status(400).json({
      error: { code: 'validation', message: 'Invalid activity kind.' },
    })
  }
  if (b.startsAt && Number.isNaN(Date.parse(b.startsAt))) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: 'Invalid start date.' } })
  }
  const activity = await addWgActivity({
    wgSlug: req.params.wg,
    kind: b.kind,
    title: String(b.title).slice(0, 200),
    body: b.body ? String(b.body).slice(0, 2000) : null,
    startsAt: b.startsAt || null,
    endsAt: b.endsAt || null,
    url: b.url || null,
    createdBy: account.id,
  })
  await recordAudit({
    actorId: account.id,
    action: 'wg.activity_created',
    targetType: 'wg_activity',
    targetId: activity.id,
    after: activity,
    requestId: req.requestId,
  })
  res.status(201).json({ activity })
})
