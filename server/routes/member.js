import { Router } from 'express'
import { getSessionAccount } from '../lib/accounts.js'
import {
  completeCourse,
  upsertWgProgress,
  getWgProgress,
  listMyWgProgress,
  listWgJoiners,
  addWgActivity,
  listWgActivities,
  listNgoRequests,
  addNgoRequest,
  updateNgoRequestStatus,
  listAccountsForAdmin,
  setAccountFields,
  resolveOrgContext,
  listNgoSeats,
  ensureOwnerSeat,
  inviteNgoSeat,
  acceptNgoInvite,
  revokeNgoSeat,
  getSeatByToken,
} from '../lib/lifecycle.js'
import { createPasswordResetToken, resetLink } from '../lib/passwordReset.js'
import {
  canManageWg,
  canReadNgo,
  canWriteNgoRequests,
  canManageNgoSeats,
} from '../lib/authorization.js'
import { appOrigin } from '../lib/config.js'
import { scoreQuiz, QUIZ, COURSE_MODULES, COURSE_VERSION, PASS_SCORE } from '../../src/content/membershipCourse.js'

export const memberRouter = Router()

function bearerToken(req) {
  const h = req.headers.authorization || ''
  if (h.startsWith('Bearer ')) return h.slice(7).trim()
  return String(req.headers['x-session-token'] || '').trim() || null
}

memberRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

async function requireAccount(req, res) {
  const account = await getSessionAccount(bearerToken(req))
  if (!account) {
    res.status(401).json({ error: { code: 'unauthorized', message: 'Sign in to continue.' } })
    return null
  }
  req.account = account
  return account
}

function requireVerified(req, res) {
  if (!req.account?.isVerified && req.account?.role !== 'admin') {
    res.status(403).json({
      error: { code: 'not_verified', message: 'Complete the membership course to unlock this feature.' },
    })
    return false
  }
  return true
}

// Course content (authenticated members)
memberRouter.get('/course', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  res.json({
    version: COURSE_VERSION,
    passScore: PASS_SCORE,
    modules: COURSE_MODULES,
    quiz: QUIZ.map(({ id, prompt, choices }) => ({ id, prompt, choices })), // no correct answers
    accountStatus: account.memberStatus,
    alreadyPassed: account.isVerified,
  })
})

memberRouter.post('/course/submit', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  try {
    const { score, total, passed } = scoreQuiz(req.body?.answers || {})
    if (!passed) {
      return res.status(400).json({
        error: {
          code: 'quiz_failed',
          message: `You scored ${score}/${total}. You need at least ${PASS_SCORE} correct to pass. Review the modules and try again.`,
        },
        score,
        total,
        passed: false,
      })
    }
    const updated = await completeCourse(account.id, { score, total })
    res.json({ ok: true, score, total, passed: true, account: updated })
  } catch (err) {
    console.error('course submit failed:', err.message)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not record course result.' } })
  }
})

// WG workspace
memberRouter.get('/workspace', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  const progress = await listMyWgProgress(account.id)
  res.json({ items: progress })
})

memberRouter.get('/workspace/:wg', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  const progress = await getWgProgress(account.id, req.params.wg)
  const unlocked = Boolean(progress?.presentation_ok && progress?.rules_ok)
  const activities = unlocked ? await listWgActivities(req.params.wg) : []
  res.json({ progress, activities })
})

memberRouter.post('/workspace/:wg/onboard', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  const { presentationOk, rulesOk } = req.body || {}
  const progress = await upsertWgProgress(account.id, req.params.wg, {
    presentation_ok: Boolean(presentationOk),
    rules_ok: Boolean(rulesOk),
    status: 'active',
  })
  res.json({ progress })
})

memberRouter.post('/workspace/:wg/join', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  const progress = await upsertWgProgress(account.id, req.params.wg, {
    status: 'pending_approval',
  })
  res.json({ progress })
})

async function requireWgManager(req, res) {
  const account = await requireAccount(req, res)
  if (!account) return null
  if (!requireVerified(req, res)) return null
  const progress = account.role === 'admin'
    ? null
    : await getWgProgress(account.id, req.params.wg)
  if (!canManageWg(account, progress, req.params.wg)) {
    res.status(403).json({
      error: { code: 'forbidden', message: 'Contact or lead access for this working group is required.' },
    })
    return null
  }
  return account
}

// CP management
memberRouter.get('/cp/:wg/members', async (req, res) => {
  const account = await requireWgManager(req, res)
  if (!account) return
  const items = await listWgJoiners(req.params.wg)
  res.json({ items })
})

memberRouter.post('/cp/:wg/members/:accountId/role', async (req, res) => {
  const account = await requireWgManager(req, res)
  if (!account) return
  const role = String(req.body?.role || 'member')
  const status = String(req.body?.status || 'active')
  if (!['member', 'contact', 'lead'].includes(role) || !['interested', 'pending_approval', 'active', 'rejected'].includes(status)) {
    return res.status(400).json({ error: { code: 'validation', message: 'Invalid WG role or status.' } })
  }
  const progress = await upsertWgProgress(req.params.accountId, req.params.wg, {
    role_in_wg: role,
    status,
  })
  res.json({ progress })
})

memberRouter.post('/cp/:wg/activities', async (req, res) => {
  const account = await requireWgManager(req, res)
  if (!account) return
  const b = req.body || {}
  if (!b.title || !b.kind) {
    return res.status(400).json({ error: { code: 'validation', message: 'title and kind are required.' } })
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
  res.status(201).json({ activity })
})

async function requireOrgContext(req, res, capability = 'read') {
  const account = await requireAccount(req, res)
  if (!account) return null
  if (!requireVerified(req, res)) return null
  const context = account.role === 'admin'
    ? {
      orgAccountId: String(req.query.orgId || '').trim() || null,
      seatRole: 'owner',
      isAdmin: true,
    }
    : await resolveOrgContext(account)

  const allowed = capability === 'manage_seats'
    ? canManageNgoSeats(context)
    : capability === 'write_requests'
      ? canWriteNgoRequests(context)
      : canReadNgo(context)

  if (!context?.orgAccountId || !allowed) {
    res.status(403).json({ error: { code: 'forbidden', message: 'Accredited NGO access required.' } })
    return null
  }
  req.orgAccountId = context.orgAccountId
  req.orgContext = context
  return account
}

// NGO platform
memberRouter.get('/ngo/requests', async (req, res) => {
  const account = await requireOrgContext(req, res)
  if (!account) return
  const items = await listNgoRequests(req.orgAccountId)
  const seats = await listNgoSeats(req.orgAccountId)
  res.json({
    items,
    seats,
    orgAccountId: req.orgAccountId,
    permissions: {
      seatRole: req.orgContext.seatRole,
      canWriteRequests: canWriteNgoRequests(req.orgContext),
      canManageSeats: canManageNgoSeats(req.orgContext),
    },
    deadlines: [
      { title: 'Side event applications (placeholder)', kind: 'deadline', note: 'Connect live UNFCCC calendars later.' },
      { title: 'COP/SB nomination windows (placeholder)', kind: 'deadline', note: 'Membership Team will publish real dates.' },
      { title: 'Submission deadlines tracked in hub Submissions', kind: 'deadline', href: '/submissions' },
    ],
  })
})

memberRouter.post('/ngo/requests', async (req, res) => {
  const account = await requireOrgContext(req, res, 'write_requests')
  if (!account) return
  const b = req.body || {}
  if (!b.title || !b.kind) {
    return res.status(400).json({ error: { code: 'validation', message: 'title and kind required.' } })
  }
  const item = await addNgoRequest({
    orgAccountId: req.orgAccountId,
    kind: b.kind,
    title: String(b.title).slice(0, 200),
    body: b.body || null,
    deadlineAt: b.deadlineAt || null,
    createdBy: account.id,
  })
  res.status(201).json({ item })
})

memberRouter.patch('/ngo/requests/:id', async (req, res) => {
  const account = await requireOrgContext(req, res, 'write_requests')
  if (!account) return
  const status = String(req.body?.status || 'done')
  if (!['open', 'in_progress', 'done', 'declined'].includes(status)) {
    return res.status(400).json({ error: { code: 'validation', message: 'Invalid request status.' } })
  }
  const item = await updateNgoRequestStatus(req.params.id, status, req.orgAccountId)
  if (!item) return res.status(404).json({ error: { code: 'not_found', message: 'Request not found.' } })
  res.json({ item })
})

memberRouter.get('/ngo/seats', async (req, res) => {
  const account = await requireOrgContext(req, res)
  if (!account) return
  const seats = await listNgoSeats(req.orgAccountId)
  res.json({ seats, orgAccountId: req.orgAccountId })
})

memberRouter.post('/ngo/seats/invite', async (req, res) => {
  const account = await requireOrgContext(req, res, 'manage_seats')
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
    res.status(201).json({
      seat: result.seat,
      inviteUrl,
      note: 'Share this one-time link with the invited representative. It expires in 7 days.',
    })
  } catch (err) {
    const status = err.code === 'duplicate' ? 409 : 400
    res.status(status).json({ error: { code: err.code || 'validation', message: err.message } })
  }
})

memberRouter.post('/ngo/seats/:id/revoke', async (req, res) => {
  const account = await requireOrgContext(req, res, 'manage_seats')
  if (!account) return
  const seat = await revokeNgoSeat(req.params.id, req.orgAccountId)
  if (!seat) {
    return res.status(400).json({ error: { code: 'cannot_revoke', message: 'Cannot revoke owner or missing seat.' } })
  }
  res.json({ seat })
})

// Public-ish invite preview (auth required to accept)
memberRouter.get('/ngo/invite/:token', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  const seat = await getSeatByToken(req.params.token, account.email)
  if (!seat) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Invite not found or already used.' } })
  }
  res.json({ seat })
})

memberRouter.post('/ngo/invite/:token/accept', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  try {
    const seat = await acceptNgoInvite(req.params.token, account)
    if (!seat) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Invite not found or already used.' } })
    }
    const refreshedAccount = await getSessionAccount(bearerToken(req))
    res.json({ ok: true, seat, account: refreshedAccount })
  } catch (err) {
    console.error('accept invite failed:', err.message)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not accept invite.' } })
  }
})

// Admin
memberRouter.get('/admin/accounts', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const items = await listAccountsForAdmin()
  res.json({ items })
})

memberRouter.post('/admin/accounts/:id/verify', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const updated = await setAccountFields(req.params.id, {
    member_status: 'verified',
    verified_at: new Date().toISOString(),
    verified_by: 'staff',
  })
  res.json({ account: updated })
})

memberRouter.post('/admin/accounts/:id/role', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const role = String(req.body?.role || 'member')
  if (!['member', 'ngo_admin', 'admin'].includes(role)) {
    return res.status(400).json({ error: { code: 'validation', message: 'Invalid role.' } })
  }
  if (role === 'ngo_admin') {
    const items = await listAccountsForAdmin()
    const target = items.find((item) => item.id === req.params.id)
    if (!target || target.entityType !== 'organization' || !target.isVerified) {
      return res.status(400).json({
        error: {
          code: 'validation',
          message: 'Only a verified organisation account can become an NGO administrator.',
        },
      })
    }
  }
  const updated = await setAccountFields(req.params.id, { role })
  if (role === 'ngo_admin') await ensureOwnerSeat(updated)
  res.json({ account: updated })
})

/** Admin: issue a password-reset link (returned once for copy — no SMTP yet). */
memberRouter.post('/admin/accounts/:id/reset-link', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  try {
    const list = await listAccountsForAdmin()
    const target = list.find((a) => a.id === req.params.id)
    if (!target) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Account not found.' } })
    }
    const created = await createPasswordResetToken(target.email)
    if (!created) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Account not found.' } })
    }
    const url = resetLink(appOrigin(), created.rawToken)
    console.log(JSON.stringify({
      event: 'admin_password_reset_issued',
      by: account.email,
      for: target.email,
      expiresAt: created.expiresAt,
    }))
    res.json({
      ok: true,
      email: target.email,
      resetUrl: url,
      expiresAt: created.expiresAt,
      message: 'Share this link with the user. It expires in 1 hour and can be used once.',
    })
  } catch (err) {
    console.error('admin reset-link failed:', err.message)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not create reset link.' } })
  }
})
