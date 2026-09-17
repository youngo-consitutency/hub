import { overview } from '../../modules/platform/service.ts'
// Member essentials: access profile, membership course, WG workspaces.
import { Router } from 'express'
import express from 'express'
import { requireAccount, requireFocalPoint, requireVerified } from './guards.js'
import {
  APPEAL_PROOF_MAX_BYTES,
  getOwnAppeal,
  submitAppeal,
} from '../../lib/membershipAppeals.js'
import { recordAudit } from '../../lib/audit.js'
import {
  COURSE_MODULES,
  COURSE_VERSION,
  PASS_SCORE,
  QUIZ,
  scoreQuiz,
} from '../../lib/membershipCourse.js'
import {
  completeCourse,
  getWgProgress,
  listMyWgProgress,
  listWgActivities,
  upsertWgProgress,
} from '../../lib/lifecycle.js'
import {
  getFeed,
  listDirectory,
  listEvents,
  listGroups,
  listSubmissions,
} from '../../lib/store.js'

export const router = Router()

router.get('/access', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  res.json(account.access)
})

router.get('/membership/appeal', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  res.json({
    membershipStatus: account.membershipStatus,
    membershipEndReason: account.membershipEndReason || null,
    appeal: await getOwnAppeal(account.id),
  })
})

router.post(
  '/membership/appeal',
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    limit: APPEAL_PROOF_MAX_BYTES,
  }),
  async (req, res) => {
    const account = await requireAccount(req, res)
    if (!account) return
    try {
      let statement = String(req.get('x-appeal-statement') || '')
      try {
        statement = decodeURIComponent(statement)
      } catch {
        /* keep the raw header if it is not URI-encoded */
      }
      const appeal = await submitAppeal({
        account,
        statement,
        identityKind: req.get('x-identity-kind'),
        bytes: Buffer.isBuffer(req.body) ? req.body : Buffer.from([]),
        contentType: req.get('content-type'),
      })
      await recordAudit({
        actorId: account.id,
        action: 'membership.appeal_submitted',
        targetType: 'membership_appeal',
        targetId: appeal.id,
        after: {
          identityKind: appeal.identityKind,
          proofContentType: appeal.proofContentType,
          proofByteSize: appeal.proofByteSize,
        },
        requestId: req.requestId,
      })
      res.status(201).json({ appeal })
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          error: { code: error.code, message: error.message },
        })
      }
      throw error
    }
  },
)

router.get('/focal/overview', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireFocalPoint(req, res)) return
  res.json({
    feed: getFeed(),
    events: listEvents()
      .filter((event) => Date.parse(event.startsAt) >= Date.now())
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    submissions: listSubmissions('open').slice(0, 8),
    decisions: (await overview(account)).decisions.filter(
      (decision) =>
        !['adopted', 'not_adopted', 'withdrawn'].includes(decision.stage),
    ),
    groups: listGroups(),
    mandateContacts: listDirectory({ member: true }).slice(0, 12),
  })
})

router.get('/course', async (req, res) => {
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

router.post('/course/submit', async (req, res) => {
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
    if (!updated)
      return res.status(403).json({
        error: {
          code: 'account_inactive',
          message: 'This account is no longer eligible for course completion.',
        },
      })
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

router.get('/workspace', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  const progress = await listMyWgProgress(account.id)
  res.json({ items: progress })
})

router.get('/workspace/:wg', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  const progress = await getWgProgress(account.id, req.params.wg)
  const unlocked = Boolean(progress?.presentation_ok && progress?.rules_ok)
  const activities = unlocked ? await listWgActivities(req.params.wg) : []
  res.json({ progress, activities })
})

router.post('/workspace/:wg/onboard', async (req, res) => {
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

router.post('/workspace/:wg/join', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!requireVerified(req, res)) return
  const progress = await upsertWgProgress(account.id, req.params.wg, {
    status: 'pending_approval',
  })
  res.json({ progress })
})
