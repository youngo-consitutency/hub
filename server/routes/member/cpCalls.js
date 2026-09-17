import { Router } from 'express'
import { recordAudit } from '../../lib/audit.js'
import {
  bookSlot,
  cancelSlot,
  createSlot,
  findBookingForAccount,
  listAllSlotsForAdmin,
  listHostSlots,
  listOpenSlots,
  releaseBooking,
} from '../../lib/cpCalls.js'
import { WORKING_GROUP_SLUGS } from '../../../shared/workingGroups.js'
import { requireAccount } from './guards.js'

export const router = Router()

function canBook(account) {
  return Boolean(
    account.isVerified ||
      account.isWgContact ||
      account.isAdmin ||
      account.role === 'wg_contact',
  )
}

router.get('/cp-calls/slots', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!canBook(account)) {
    return res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Sign in with your Contact Point account to book a call.',
      },
    })
  }
  const [slots, mine] = await Promise.all([
    listOpenSlots(),
    findBookingForAccount(account.id),
  ])
  res.json({ slots, mine })
})

router.post('/cp-calls/slots/:id/book', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!canBook(account)) {
    return res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Sign in with your Contact Point account to book a call.',
      },
    })
  }
  const wgSlug = String(req.body?.wgSlug || '').trim()
  if (wgSlug && !WORKING_GROUP_SLUGS.has(wgSlug)) {
    return res.status(400).json({
      error: { code: 'validation', message: 'Unknown working group.' },
    })
  }
  try {
    const slot = await bookSlot({
      slotId: req.params.id,
      accountId: account.id,
      wgSlug: wgSlug || account.access?.wgAssignments?.[0]?.wgSlug || null,
      notes: req.body?.notes ? String(req.body.notes).slice(0, 500) : null,
    })
    await recordAudit({
      actorId: account.id,
      action: 'cp_call.booked',
      targetType: 'cp_call_slot',
      targetId: slot.id,
      after: slot,
      requestId: req.requestId,
    })
    res.status(201).json({ slot })
  } catch (error) {
    if (error.code === 'conflict') {
      return res.status(409).json({
        error: { code: 'conflict', message: error.message },
      })
    }
    throw error
  }
})

router.post('/cp-calls/mine/cancel', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  const released = await releaseBooking(account.id)
  res.json({ released })
})

router.get('/admin/cp-calls', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  res.json({ slots: await listAllSlotsForAdmin() })
})

router.get('/admin/cp-calls/mine', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  res.json({ slots: await listHostSlots(account.id) })
})

router.post('/admin/cp-calls', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const hostLabel =
    String(req.body?.hostLabel || '').trim() ||
    account.firstName ||
    account.name ||
    'Host'
  const items = Array.isArray(req.body?.slots)
    ? req.body.slots
    : [{ startsAt: req.body?.startsAt, endsAt: req.body?.endsAt }]
  const created = []
  try {
    for (const item of items) {
      created.push(
        await createSlot({
          hostAccountId: account.id,
          hostLabel,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
        }),
      )
    }
  } catch (error) {
    if (error.code === 'validation' || error.code === 'conflict') {
      return res.status(error.code === 'conflict' ? 409 : 400).json({
        error: { code: error.code, message: error.message },
        created,
      })
    }
    throw error
  }
  res.status(201).json({ slots: created })
})

router.post('/admin/cp-calls/:id/cancel', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const slot = await cancelSlot(req.params.id, account.id, true)
  if (!slot) {
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Slot not found.' } })
  }
  res.json({ slot })
})
