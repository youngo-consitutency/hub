// Member essentials: access profile, membership course, WG workspaces.
import { Router } from 'express'
import { requireAccount, requireFocalPoint, requireVerified } from './guards.js'
import {
  COURSE_MODULES,
  COURSE_VERSION,
  PASS_SCORE,
  QUIZ,
  scoreQuiz,
} from '../../../src/content/membershipCourse.js'
import { getAccessProfile } from '../../lib/access.js'
import {
  completeCourse,
  getWgProgress,
  listMyWgProgress,
  listWgActivities,
  upsertWgProgress,
} from '../../lib/lifecycle.js'
import {
  getFeed,
  listCouncil,
  listDirectory,
  listEvents,
  listGroups,
  listSubmissions,
} from '../../lib/store.js'

export const router = Router()

router.get('/access', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  res.json(await getAccessProfile(account))
})

router.get('/focal/overview', async (req, res) => {
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
