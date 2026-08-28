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
import { requireAccount, requireVerified } from './guards.js'

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
    const items = await listContentRevisions({ actorId: account.id })
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
