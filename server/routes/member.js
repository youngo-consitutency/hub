import { Router } from 'express'
import { destroyAllSessions, getSessionAccount } from '../lib/accounts.js'
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
  queryAccountsForAdmin,
  setAccountFields,
  resolveOrgContext,
  listNgoSeats,
  ensureOwnerSeat,
  inviteNgoSeat,
  acceptNgoInvite,
  revokeNgoSeat,
  getSeatByToken,
} from '../lib/lifecycle.js'
import {
  getAccessProfile,
  hasCapability,
  canManageWg,
  setTeamAssignment,
  syncWgAssignment,
} from '../lib/access.js'
import { recordAudit, listAudit } from '../lib/audit.js'
import {
  createGysContribution,
  getGysWorkflow,
  updateGysContribution,
} from '../lib/gysWorkflow.js'
import {
  getFeed,
  getGys,
  listEvents,
  listAnnouncements,
  listGroups,
  listSubmissions,
  listCouncil,
  listDirectory,
} from '../lib/store.js'
import { createPasswordResetToken, resetLink } from '../lib/passwordReset.js'
import { canWriteNgoRequests, canManageNgoSeats } from '../lib/authorization.js'
import { appOrigin } from '../lib/config.js'
import {
  scoreQuiz,
  QUIZ,
  COURSE_MODULES,
  COURSE_VERSION,
  PASS_SCORE,
} from '../../src/content/membershipCourse.js'
import { cookieValue, SESSION_COOKIE } from '../lib/security.js'
import {
  POINT_REASONS,
  RECOGNITION_TIERS,
  awardOrgPoints,
  canAwardPoints,
  getOrgPointsBalance,
  listAwardSuggestions,
  listOrgPointBalances,
  listOrgPointsLedger,
  listRecentPointAwards,
  reasonFromNgoRequestKind,
  tiersForBalance,
} from '../lib/points.js'
import { WG_ACTIVITY_KIND_VALUES } from '../../shared/workflows.js'
import {
  createContentRevision,
  updateContentRevision,
  submitContentRevision,
  reviewContentRevision,
  publishContentRevision,
  listContentRevisions,
  listContentPublications,
} from '../lib/contentWorkflow.js'

export const memberRouter = Router()

function bearerToken(req) {
  const h = req.headers.authorization || ''
  if (h.startsWith('Bearer ')) return h.slice(7).trim()
  return (
    String(req.headers['x-session-token'] || '').trim() ||
    cookieValue(req, SESSION_COOKIE) ||
    null
  )
}

memberRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

async function requireAccount(req, res) {
  const account = await getSessionAccount(bearerToken(req))
  if (!account) {
    res.status(401).json({
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    })
    return null
  }
  req.account = account
  return account
}

function requireVerified(req, res) {
  if (!req.account?.isVerified) {
    res.status(403).json({
      error: {
        code: 'not_verified',
        message: 'Complete the membership course to use this feature.',
      },
    })
    return false
  }
  return true
}

async function requireTeam(req, res, teamRole) {
  const access = await getAccessProfile(req.account)
  if (!access.teamRoles.includes(teamRole)) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'This team workspace is not assigned to your account.',
      },
    })
    return null
  }
  return access
}

async function requireCapability(req, res, capability) {
  const access = await getAccessProfile(req.account)
  if (!hasCapability(access, capability)) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'This content responsibility is not assigned to your account.',
      },
    })
    return null
  }
  return access
}

function requireFocalPoint(req, res) {
  if (!['admin', 'focal_point'].includes(req.account?.role)) {
    res.status(403).json({
      error: { code: 'forbidden', message: 'Focal Point access required.' },
    })
    return false
  }
  return true
}

function sendContentWorkflowError(res, error) {
  const status = {
    validation: 400,
    not_found: 404,
    forbidden: 403,
    invalid_status: 409,
    separation_of_duties: 409,
    conflict: 409,
  }[error.code]
  if (!status) return false
  res.status(status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
  })
  return true
}

const MEMBERSHIP_STATUSES = [
  'registered',
  'course_passed',
  'awaiting_onboarding',
  'active',
  'renewal_due',
  'expired',
  'terminated',
]

function routeError(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

function sendRouteError(res, error) {
  if (!error.status) return false
  res.status(error.status).json({
    error: { code: error.code || 'request_failed', message: error.message },
  })
  return true
}

function adminReason(req, res) {
  const reason = String(req.body?.reason || '').trim()
  if (reason.length < 8) {
    res.status(400).json({
      error: {
        code: 'validation',
        message:
          'Give a reason of at least 8 characters for this admin action.',
      },
    })
    return null
  }
  return reason.slice(0, 500)
}

async function updateMembershipLifecycle({ actor, targetId, body }) {
  const status = String(body?.status || '')
  if (!MEMBERSHIP_STATUSES.includes(status))
    throw routeError(400, 'validation', 'Invalid membership status.')
  const items = await listAccountsForAdmin()
  const before = items.find((item) => item.id === targetId)
  if (!before) throw routeError(404, 'not_found', 'Account not found.')
  if (actor.role !== 'admin' && ['admin', 'focal_point'].includes(before.role))
    throw routeError(
      403,
      'forbidden',
      'Only an admin can change platform staff membership.',
    )
  if (actor.id === before.id && ['expired', 'terminated'].includes(status))
    throw routeError(
      400,
      'self_suspend',
      'You cannot suspend your own admin account.',
    )
  if (
    status === 'active' &&
    !before.coursePassedAt &&
    !['admin', 'focal_point'].includes(before.role)
  )
    throw routeError(
      409,
      'course_required',
      'The member must pass the membership course before activation.',
    )
  const reason = String(body?.reason || '').trim()
  if (status === 'terminated' && !reason)
    throw routeError(
      400,
      'validation',
      'A reason is required when terminating membership.',
    )
  if (body?.renewalDueAt && Number.isNaN(Date.parse(body.renewalDueAt)))
    throw routeError(400, 'validation', 'Invalid renewal date.')

  const now = new Date().toISOString()
  const accessStatus = ['expired', 'terminated'].includes(status)
    ? 'suspended'
    : [
          'course_passed',
          'awaiting_onboarding',
          'active',
          'renewal_due',
        ].includes(status)
      ? 'active'
      : 'pending_course'
  const updated = await setAccountFields(targetId, {
    membership_status: status,
    hub_access_status: accessStatus,
    ...(status === 'active'
      ? { member_status: 'verified', verified_at: before.verifiedAt || now }
      : {}),
    onboarding_cohort:
      body?.onboardingCohort || before.onboardingCohort || null,
    renewal_due_at: body?.renewalDueAt || before.renewalDueAt || null,
    membership_ended_at: ['expired', 'terminated'].includes(status)
      ? now
      : null,
    membership_end_reason: ['expired', 'terminated'].includes(status)
      ? reason.slice(0, 500) || null
      : null,
    constituency_work_status:
      status === 'active'
        ? 'active'
        : status === 'awaiting_onboarding'
          ? 'pending_onboarding'
          : before.constituencyWorkStatus,
  })
  if (accessStatus === 'suspended') await destroyAllSessions(targetId)
  return { before, updated, reason: reason || null }
}

memberRouter.get('/access', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  res.json(await getAccessProfile(account))
})

memberRouter.get('/focal/overview', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireFocalPoint(req, res)) return
  res.json({
    feed: getFeed(),
    events: listEvents().slice(0, 8),
    submissions: listSubmissions('open').slice(0, 8),
    decisions: listCouncil('active').slice(0, 8),
    groups: listGroups(),
    mandateContacts: listDirectory({ member: true }).slice(0, 12),
  })
})

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
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Could not record course result.',
      },
    })
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
  if (!(await canManageWg(account, req.params.wg))) {
    res.status(403).json({
      error: {
        code: 'forbidden',
        message: 'Contact or lead access for this working group is required.',
      },
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
  if (
    !['member', 'contact', 'lead'].includes(role) ||
    !['interested', 'pending_approval', 'active', 'rejected'].includes(status)
  ) {
    return res.status(400).json({
      error: { code: 'validation', message: 'Invalid WG role or status.' },
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
  const progress = await upsertWgProgress(req.params.accountId, req.params.wg, {
    role_in_wg: role,
    status,
  })
  await syncWgAssignment({
    accountId: req.params.accountId,
    wgSlug: req.params.wg,
    role,
    status,
    assignedBy: account.id,
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

memberRouter.post('/cp/:wg/activities', async (req, res) => {
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

// NGO platform
memberRouter.get('/ngo/requests', async (req, res) => {
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

memberRouter.get('/ngo/points', async (req, res) => {
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

// Staff: award contribution points (admin, focal point, membership team)
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

memberRouter.get('/staff/points', async (req, res) => {
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

memberRouter.post('/staff/points/award', async (req, res) => {
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
memberRouter.post('/staff/points/award-suggestion', async (req, res) => {
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

memberRouter.get('/staff/points/reasons', async (req, res) => {
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

memberRouter.post('/ngo/requests', async (req, res) => {
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

memberRouter.patch('/ngo/requests/:id', async (req, res) => {
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

memberRouter.get('/ngo/seats', async (req, res) => {
  const account = await requireOrgScope(req, res)
  if (!account) return
  const seats = await listNgoSeats(req.orgAccountId)
  res.json({ seats, orgAccountId: req.orgAccountId })
})

memberRouter.post('/ngo/seats/invite', async (req, res) => {
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

memberRouter.post('/ngo/seats/:id/revoke', async (req, res) => {
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

// Public-ish invite preview (auth required to accept)
memberRouter.get('/ngo/invite/:token', async (req, res) => {
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

memberRouter.post('/ngo/invite/:token/accept', async (req, res) => {
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

// Admin
memberRouter.get('/team/membership/overview', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!(await requireTeam(req, res, 'membership_team'))) return
  const items = await listAccountsForAdmin()
  res.json({ items })
})

memberRouter.post('/team/membership/accounts/:id/verify', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!(await requireTeam(req, res, 'membership_team'))) return
  const updated = await setAccountFields(req.params.id, {
    member_status: 'verified',
    hub_access_status: 'active',
    membership_status: 'active',
    constituency_work_status: 'active',
    verified_at: new Date().toISOString(),
    verified_by: account.email,
  })
  await recordAudit({
    actorId: account.id,
    action: 'membership.status_changed',
    targetType: 'account',
    targetId: req.params.id,
    after: updated,
    reason: req.body?.reason,
    requestId: req.requestId,
  })
  res.json({ account: updated })
})

memberRouter.patch('/team/membership/accounts/:id/status', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!(await requireTeam(req, res, 'membership_team'))) return
  try {
    const result = await updateMembershipLifecycle({
      actor: account,
      targetId: req.params.id,
      body: req.body,
    })
    await recordAudit({
      actorId: account.id,
      action: 'membership.status_changed',
      targetType: 'account',
      targetId: req.params.id,
      before: result.before,
      after: result.updated,
      reason: result.reason,
      requestId: req.requestId,
    })
    res.json({ account: result.updated })
  } catch (error) {
    if (!sendRouteError(res, error)) throw error
  }
})

memberRouter.get('/team/gys/overview', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!(await requireTeam(req, res, 'gys_policy_team'))) return
  const gys = getGys()
  const workflow = await getGysWorkflow()
  res.json({
    current: workflow.cycle || gys?.current || null,
    process: gys?.process || [],
    contributions: workflow.contributions,
    statuses: workflow.statuses,
    submissions: listSubmissions('open'),
    decisions: listCouncil('active'),
  })
})

memberRouter.post('/team/gys/contributions', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!(await requireTeam(req, res, 'gys_policy_team'))) return
  try {
    const contribution = await createGysContribution({
      ...req.body,
      authorId: account.id,
    })
    await recordAudit({
      actorId: account.id,
      action: 'gys.contribution_created',
      targetType: 'gys_contribution',
      targetId: contribution.id,
      after: contribution,
      requestId: req.requestId,
    })
    res.status(201).json({ contribution })
  } catch (error) {
    if (error.code === 'validation')
      return res
        .status(400)
        .json({ error: { code: error.code, message: error.message } })
    throw error
  }
})

memberRouter.patch('/team/gys/contributions/:id', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!(await requireTeam(req, res, 'gys_policy_team'))) return
  try {
    const result = await updateGysContribution({
      id: req.params.id,
      status: String(req.body?.status || ''),
      reviewerId: req.body?.reviewerId,
      actorId: account.id,
      note: req.body?.note,
      decision: req.body?.decision,
    })
    if (!result)
      return res.status(404).json({
        error: { code: 'not_found', message: 'Contribution not found.' },
      })
    await recordAudit({
      actorId: account.id,
      action: 'gys.contribution_status_changed',
      targetType: 'gys_contribution',
      targetId: req.params.id,
      before: result.before,
      after: result.contribution,
      reason: req.body?.note,
      requestId: req.requestId,
    })
    res.json(result)
  } catch (error) {
    if (error.code === 'validation')
      return res
        .status(400)
        .json({ error: { code: error.code, message: error.message } })
    throw error
  }
})

memberRouter.get('/content', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(req, res)) return
    const access = await getAccessProfile(account)
    const canDraft = hasCapability(access, 'content.draft')
    const canReview = hasCapability(access, 'content.review')
    const canPublish = hasCapability(access, 'content.publish')
    if (!canDraft && !canReview) {
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'Content workspace access is not assigned.',
        },
      })
    }
    res.json({
      permissions: { canDraft, canReview, canPublish },
      items: await listContentRevisions({ actorId: account.id, canReview }),
      publications: await listContentPublications(),
      groups: listGroups().map(({ slug, name }) => ({ slug, name })),
      live: {
        events: listEvents(),
        announcements: listAnnouncements(),
      },
    })
  } catch (error) {
    next(error)
  }
})

memberRouter.post('/content/drafts', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(req, res)) return
    if (!(await requireCapability(req, res, 'content.draft'))) return
    const item = await createContentRevision({
      actorId: account.id,
      contentType: String(req.body?.contentType || ''),
      payload: req.body?.payload,
      groupSlugs: listGroups().map((group) => group.slug),
    })
    await recordAudit({
      actorId: account.id,
      action: 'content.draft_created',
      targetType: 'content_revision',
      targetId: item.id,
      after: {
        contentType: item.contentType,
        contentKey: item.contentKey,
        status: item.status,
      },
      requestId: req.requestId,
    })
    res.status(201).json({ item })
  } catch (error) {
    if (!sendContentWorkflowError(res, error)) next(error)
  }
})

memberRouter.patch('/content/drafts/:id', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(req, res)) return
    if (!(await requireCapability(req, res, 'content.draft'))) return
    const item = await updateContentRevision({
      id: req.params.id,
      actorId: account.id,
      payload: req.body?.payload,
      groupSlugs: listGroups().map((group) => group.slug),
    })
    await recordAudit({
      actorId: account.id,
      action: 'content.draft_updated',
      targetType: 'content_revision',
      targetId: item.id,
      after: {
        contentType: item.contentType,
        contentKey: item.contentKey,
        status: item.status,
      },
      requestId: req.requestId,
    })
    res.json({ item })
  } catch (error) {
    if (!sendContentWorkflowError(res, error)) next(error)
  }
})

memberRouter.post('/content/drafts/:id/submit', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(req, res)) return
    if (!(await requireCapability(req, res, 'content.draft'))) return
    const item = await submitContentRevision({
      id: req.params.id,
      actorId: account.id,
    })
    await recordAudit({
      actorId: account.id,
      action: 'content.review_requested',
      targetType: 'content_revision',
      targetId: item.id,
      after: { status: item.status },
      requestId: req.requestId,
    })
    res.json({ item })
  } catch (error) {
    if (!sendContentWorkflowError(res, error)) next(error)
  }
})

memberRouter.post('/content/drafts/:id/review', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(req, res)) return
    if (!(await requireCapability(req, res, 'content.review'))) return
    const item = await reviewContentRevision({
      id: req.params.id,
      actorId: account.id,
      decision: String(req.body?.decision || ''),
      note: req.body?.note,
    })
    await recordAudit({
      actorId: account.id,
      action: `content.review_${String(req.body?.decision || '')}`,
      targetType: 'content_revision',
      targetId: item.id,
      after: { status: item.status },
      reason: item.reviewNote,
      requestId: req.requestId,
    })
    res.json({ item })
  } catch (error) {
    if (!sendContentWorkflowError(res, error)) next(error)
  }
})

memberRouter.post('/content/drafts/:id/publish', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(req, res)) return
    if (!(await requireCapability(req, res, 'content.publish'))) return
    const publication = await publishContentRevision({
      id: req.params.id,
      actorId: account.id,
    })
    await recordAudit({
      actorId: account.id,
      action: 'content.published',
      targetType: publication.contentType,
      targetId: publication.contentKey,
      after: {
        revisionId: publication.revisionId,
        publishedAt: publication.publishedAt,
      },
      requestId: req.requestId,
    })
    res.json({ publication })
  } catch (error) {
    if (!sendContentWorkflowError(res, error)) next(error)
  }
})

memberRouter.get('/admin/accounts', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  res.json(
    await queryAccountsForAdmin({
      search: req.query.search,
      entityType: req.query.entityType,
      status: req.query.status,
      role: req.query.role,
      sort: req.query.sort,
      page: req.query.page,
      pageSize: req.query.pageSize,
    }),
  )
})

memberRouter.get('/admin/audit', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin')
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  res.json({
    items: await listAudit({
      limit: req.query.limit,
      targetType: req.query.targetType || null,
    }),
  })
})

memberRouter.post('/admin/accounts/:id/verify', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const reason = adminReason(req, res)
  if (!reason) return
  const items = await listAccountsForAdmin()
  const before = items.find((item) => item.id === req.params.id)
  if (!before)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Account not found.' } })
  const updated = await setAccountFields(req.params.id, {
    member_status: 'verified',
    hub_access_status: 'active',
    membership_status: 'active',
    verified_at: new Date().toISOString(),
    verified_by: 'staff',
  })
  await recordAudit({
    actorId: account.id,
    action: 'membership.status_changed',
    targetType: 'account',
    targetId: req.params.id,
    before,
    after: updated,
    reason,
    requestId: req.requestId,
  })
  res.json({ account: updated })
})

memberRouter.patch('/admin/accounts/:id/status', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin')
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  const reason = adminReason(req, res)
  if (!reason) return
  try {
    const result = await updateMembershipLifecycle({
      actor: account,
      targetId: req.params.id,
      body: { ...req.body, reason },
    })
    await recordAudit({
      actorId: account.id,
      action: 'membership.status_changed',
      targetType: 'account',
      targetId: req.params.id,
      before: result.before,
      after: result.updated,
      reason,
      requestId: req.requestId,
    })
    res.json({ account: result.updated })
  } catch (error) {
    if (!sendRouteError(res, error)) throw error
  }
})

memberRouter.post('/admin/accounts/:id/role', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const reason = adminReason(req, res)
  if (!reason) return
  const role = String(req.body?.role || 'member')
  if (
    !['member', 'focal_point', 'wg_contact', 'ngo_admin', 'admin'].includes(
      role,
    )
  ) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: 'Invalid role.' } })
  }
  const items = await listAccountsForAdmin()
  const target = items.find((item) => item.id === req.params.id)
  if (!target)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Account not found.' } })
  if (target.id === account.id && role !== 'admin') {
    return res.status(400).json({
      error: {
        code: 'self_demote',
        message: 'You cannot remove your own admin access.',
      },
    })
  }
  if (
    role === 'ngo_admin' &&
    (target.entityType !== 'organization' || !target.isVerified)
  ) {
    return res.status(400).json({
      error: {
        code: 'validation',
        message:
          'Only a verified organisation account can become an NGO administrator.',
      },
    })
  }
  const updated = await setAccountFields(req.params.id, { role })
  if (role === 'ngo_admin') await ensureOwnerSeat(updated)
  await recordAudit({
    actorId: account.id,
    action: 'account.platform_role_changed',
    targetType: 'account',
    targetId: req.params.id,
    before: { role: target?.role },
    after: { role },
    reason,
    requestId: req.requestId,
  })
  res.json({ account: updated })
})

memberRouter.post('/admin/accounts/:id/team-role', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const reason = adminReason(req, res)
  if (!reason) return
  const teamRole = String(req.body?.teamRole || '')
  if (
    ![
      'membership_team',
      'gys_policy_team',
      'content_editor',
      'content_publisher',
    ].includes(teamRole)
  ) {
    return res
      .status(400)
      .json({ error: { code: 'validation', message: 'Invalid team role.' } })
  }
  const items = await listAccountsForAdmin()
  const target = items.find((item) => item.id === req.params.id)
  if (!target)
    return res
      .status(404)
      .json({ error: { code: 'not_found', message: 'Account not found.' } })
  const roles = new Set(target.teamRoles || [])
  if (req.body?.enabled === false) roles.delete(teamRole)
  else roles.add(teamRole)
  const updated = await setAccountFields(req.params.id, {
    team_roles: [...roles],
  })
  await setTeamAssignment({
    accountId: req.params.id,
    teamRole,
    enabled: req.body?.enabled !== false,
    assignedBy: account.id,
  })
  await recordAudit({
    actorId: account.id,
    action: 'account.team_assignment_changed',
    targetType: 'account',
    targetId: req.params.id,
    before: { teamRoles: target.teamRoles },
    after: { teamRoles: [...roles] },
    reason,
    requestId: req.requestId,
  })
  res.json({ account: updated })
})

/** Admin: issue a password-reset link (returned once for copy — no SMTP yet). */
memberRouter.post('/admin/accounts/:id/reset-link', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (account.role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Admin access required.' } })
  }
  const reason = adminReason(req, res)
  if (!reason) return
  try {
    const list = await listAccountsForAdmin()
    const target = list.find((a) => a.id === req.params.id)
    if (!target) {
      return res
        .status(404)
        .json({ error: { code: 'not_found', message: 'Account not found.' } })
    }
    const created = await createPasswordResetToken(target.email)
    if (!created) {
      return res
        .status(404)
        .json({ error: { code: 'not_found', message: 'Account not found.' } })
    }
    const url = resetLink(appOrigin(), created.rawToken)
    console.log(
      JSON.stringify({
        event: 'admin_password_reset_issued',
        by: account.email,
        for: target.email,
        expiresAt: created.expiresAt,
      }),
    )
    await recordAudit({
      actorId: account.id,
      action: 'account.password_reset_issued',
      targetType: 'account',
      targetId: target.id,
      after: { expiresAt: created.expiresAt },
      reason,
      requestId: req.requestId,
    })
    res.json({
      ok: true,
      email: target.email,
      resetUrl: url,
      expiresAt: created.expiresAt,
      message:
        'Share this link with the user. It expires in 1 hour and can be used once.',
    })
  } catch (err) {
    console.error('admin reset-link failed:', err.message)
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Could not create reset link.',
      },
    })
  }
})
