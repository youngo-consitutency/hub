import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { recordAudit } from '../../lib/audit.js'
import {
  createContentRevision,
  getContentRevision,
  listContentRevisions,
  submitContentRevision,
  updateContentRevision,
} from '../../lib/contentWorkflow.js'
import { createRateLimiter } from '../../lib/rateLimit.js'
import {
  checkResourceDuplicate,
  listResourceCatalogue,
  listResourceIssues,
  reportResourceIssue,
  requireResource,
  verifyResource,
} from '../../lib/resourceCatalogue.js'
import { getPool } from '../../lib/db.js'
import { requireAccount, requireCapability, requireVerified } from './guards.js'

export const router = Router()
const submissionLimit = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
})

function resourceSlug(title) {
  const base = String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)
  return `${base || 'resource'}-${randomUUID().slice(0, 8)}`
}

function sendWorkflowError(res, error) {
  const status = {
    validation: 400,
    not_found: 404,
    forbidden: 403,
    invalid_status: 409,
    conflict: 409,
    separation_of_duties: 409,
    unavailable: 503,
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

router.get('/resources/submissions/mine', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(req, res)) return
    const items = await listContentRevisions({
      actorId: account.id,
      contentType: 'resource',
    })
    res.json({ items: items.filter((item) => item.contentType === 'resource') })
  } catch (error) {
    next(error)
  }
})

router.post(
  '/resources/submissions',
  submissionLimit,
  async (req, res, next) => {
    try {
      const account = await requireAccount(req, res)
      if (!account || !requireVerified(req, res)) return
      await checkResourceDuplicate(req.body?.url)
      const draft = await createContentRevision({
        actorId: account.id,
        contentType: 'resource',
        payload: { ...req.body, slug: resourceSlug(req.body?.title) },
      })
      const item = await submitContentRevision({
        id: draft.id,
        actorId: account.id,
      })
      await recordAudit({
        actorId: account.id,
        action: 'resource.submitted',
        targetType: 'content_revision',
        targetId: item.id,
        after: {
          contentKey: item.contentKey,
          status: item.status,
        },
        requestId: req.requestId,
      })
      res.status(201).json({ item })
    } catch (error) {
      if (!sendWorkflowError(res, error)) next(error)
    }
  },
)

router.patch('/resources/submissions/:id', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(req, res)) return
    const current = await getContentRevision(req.params.id)
    if (!current || current.contentType !== 'resource') {
      return res.status(404).json({
        error: { code: 'not_found', message: 'Resource submission not found.' },
      })
    }
    await checkResourceDuplicate(req.body?.url, current.contentKey)
    const draft = await updateContentRevision({
      id: req.params.id,
      actorId: account.id,
      payload: { ...req.body, slug: current.contentKey },
    })
    const item = await submitContentRevision({
      id: draft.id,
      actorId: account.id,
    })
    await recordAudit({
      actorId: account.id,
      action: 'resource.resubmitted',
      targetType: 'content_revision',
      targetId: item.id,
      after: { contentKey: item.contentKey, status: item.status },
      requestId: req.requestId,
    })
    res.json({ item })
  } catch (error) {
    if (!sendWorkflowError(res, error)) next(error)
  }
})

router.get('/resources/issues', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (
      !account ||
      !requireVerified(req, res) ||
      !(await requireCapability(req, res, 'content.review'))
    )
      return
    const items = await listResourceCatalogue({ includeRetired: true })
    const issues = await listResourceIssues()
    const submissions = await listContentRevisions({
      actorId: account.id,
      canReview: true,
      contentType: 'resource',
      limit: 500,
    })
    const reviews = (
      await getPool().query(
        `SELECT DISTINCT ON (r.resource_slug) r.resource_slug AS "resourceSlug", r.status, r.note, r.reviewed_at AS "reviewedAt", a.name AS "reviewerName" FROM resource_reviews r LEFT JOIN hub_accounts a ON a.id=r.reviewed_by ORDER BY r.resource_slug,r.reviewed_at DESC,r.id DESC`,
      )
    ).rows
    res.json({
      items,
      issues,
      reviews,
      submissions: submissions
        .filter((item) => ['in_review', 'approved'].includes(item.status))
        .map(({ creatorEmail: _privateEmail, ...item }) => item),
    })
  } catch (error) {
    if (!sendWorkflowError(res, error)) next(error)
  }
})

router.post(
  '/resources/:slug/issues',
  submissionLimit,
  async (req, res, next) => {
    try {
      const account = await requireAccount(req, res)
      if (!account || !requireVerified(req, res)) return
      const item = await reportResourceIssue({
        slug: req.params.slug,
        actorId: account.id,
        kind: req.body?.kind,
        detail: req.body?.detail,
      })
      await recordAudit({
        actorId: account.id,
        action: 'resource.issue_reported',
        targetType: 'resource_issue',
        targetId: item.id,
        after: { resourceSlug: req.params.slug },
        requestId: req.requestId,
      })
      res.status(201).json({ item })
    } catch (error) {
      if (!sendWorkflowError(res, error)) next(error)
    }
  },
)

router.post('/resources/:slug/verify', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (
      !account ||
      !requireVerified(req, res) ||
      !(await requireCapability(req, res, 'content.review'))
    )
      return
    const item = await verifyResource({
      ...req.body,
      slug: req.params.slug,
      actorId: account.id,
    })
    await recordAudit({
      actorId: account.id,
      action: 'resource.verified_review',
      targetType: 'resource_review',
      targetId: item.id,
      after: { resourceSlug: req.params.slug, status: item.status },
      requestId: req.requestId,
    })
    res.json({ item })
  } catch (error) {
    if (!sendWorkflowError(res, error)) next(error)
  }
})

router.post(
  '/resources/:slug/corrections',
  submissionLimit,
  async (req, res, next) => {
    try {
      const account = await requireAccount(req, res)
      if (!account || !requireVerified(req, res)) return
      const resource = await requireResource(req.params.slug)
      await checkResourceDuplicate(req.body?.url, resource.slug)
      const draft = await createContentRevision({
        actorId: account.id,
        contentType: 'resource',
        payload: { ...req.body, slug: resource.slug },
      })
      const item = await submitContentRevision({
        id: draft.id,
        actorId: account.id,
      })
      await recordAudit({
        actorId: account.id,
        action: 'resource.correction_submitted',
        targetType: 'content_revision',
        targetId: item.id,
        after: { contentKey: item.contentKey, status: item.status },
        requestId: req.requestId,
      })
      res.status(201).json({ item })
    } catch (error) {
      if (!sendWorkflowError(res, error)) next(error)
    }
  },
)
