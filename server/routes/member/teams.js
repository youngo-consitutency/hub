// Membership and GYS policy team workspaces.
import { Router } from 'express'
import {
  requireAccount,
  requireTeam,
  sendRouteError,
  updateMembershipLifecycle,
} from './guards.js'
import { recordAudit } from '../../lib/audit.js'
import {
  createGysContribution,
  getGysWorkflow,
  importGysContributionsFromCsv,
  setGysCycleStatus,
  updateGysContribution,
} from '../../lib/gysWorkflow.js'
import { previewCsvImport } from '../../lib/gysImport.js'
import { setAccountFields } from '../../lib/lifecycle.js'
import { listMembershipReviewItems } from '../../lib/membershipReview.js'
import { listMemberProfileSummaries } from '../../lib/memberProfiles.js'
import { getGys, listCouncil, listSubmissions } from '../../lib/store.js'

export const router = Router()

router.get('/team/membership/overview', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!(await requireTeam(req, res, 'membership_team'))) return
  const items = await listMembershipReviewItems()
  const profiles = await listMemberProfileSummaries(items)
  res.json({
    items: items.map((item) => ({
      ...item,
      profile: profiles.get(item.id),
    })),
  })
})

router.post('/team/membership/accounts/:id/verify', async (req, res) => {
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

router.patch('/team/membership/accounts/:id/status', async (req, res) => {
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

router.get('/team/gys/overview', async (req, res) => {
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
    synthesis: workflow.synthesis,
    formUrl: gys?.current?.inputsUrl || 'https://forms.gle/7Hw2ZQoxPvWzaotL9',
    submissions: listSubmissions('open'),
    decisions: listCouncil('active'),
  })
})

router.post('/team/gys/inputs/preview', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!(await requireTeam(req, res, 'gys_policy_team'))) return
  const preview = previewCsvImport(req.body?.csvText, req.body?.columnMap)
  if (!preview.ok) {
    return res.status(400).json({
      error: { code: 'validation', message: preview.error },
    })
  }
  res.json(preview)
})

router.post('/team/gys/inputs/import', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!(await requireTeam(req, res, 'gys_policy_team'))) return
  try {
    const workflow = await getGysWorkflow()
    const result = await importGysContributionsFromCsv({
      csvText: req.body?.csvText,
      columnMap: req.body?.columnMap,
      authorId: account.id,
    })
    await recordAudit({
      actorId: account.id,
      action: 'gys.inputs_imported',
      targetType: 'gys_cycle',
      targetId: workflow.cycle?.id,
      after: {
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors.length,
      },
      requestId: req.requestId,
    })
    res.status(201).json(result)
  } catch (error) {
    if (error.code === 'validation')
      return res
        .status(400)
        .json({ error: { code: error.code, message: error.message } })
    throw error
  }
})

router.patch('/team/gys/cycle', async (req, res) => {
  const account = await requireAccount(req, res)
  if (!account) return
  if (!(await requireTeam(req, res, 'gys_policy_team'))) return
  try {
    const cycle = await setGysCycleStatus(String(req.body?.status || ''))
    if (!cycle)
      return res.status(404).json({
        error: { code: 'not_found', message: 'No active GYS cycle.' },
      })
    await recordAudit({
      actorId: account.id,
      action: 'gys.cycle_status_changed',
      targetType: 'gys_cycle',
      targetId: cycle.id,
      after: cycle,
      requestId: req.requestId,
    })
    res.json({ cycle })
  } catch (error) {
    if (error.code === 'validation')
      return res
        .status(400)
        .json({ error: { code: error.code, message: error.message } })
    throw error
  }
})

router.post('/team/gys/contributions', async (req, res) => {
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

router.patch('/team/gys/contributions/:id', async (req, res) => {
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
