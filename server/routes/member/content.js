// Content studio: draft, review and publish workflow.
import { Router } from 'express'
import { requireAccount, requireCapability, requireVerified } from './guards.js'
import { getAccessProfile, hasCapability } from '../../lib/access.js'
import { recordAudit } from '../../lib/audit.js'
import {
  applyLiveContentUpdate,
  createContentRevision,
  draftLiveContentUpdate,
  getLiveContentRecord,
  listContentPublications,
  listContentRevisions,
  publishContentRevision,
  reviewContentRevision,
  submitContentRevision,
  unpublishLiveContent,
  updateContentRevision,
} from '../../lib/contentWorkflow.js'
import { listAnnouncements, listEvents, listGroups } from '../../lib/store.js'

export const router = Router()

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

router.get('/content', async (req, res, next) => {
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

router.post('/content/drafts', async (req, res, next) => {
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

router.patch('/content/drafts/:id', async (req, res, next) => {
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

router.post('/content/drafts/:id/submit', async (req, res, next) => {
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

router.post('/content/drafts/:id/review', async (req, res, next) => {
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

router.get('/content/live/:contentType/:slug', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(req, res)) return
    const access = await getAccessProfile(account)
    if (
      !hasCapability(access, 'content.draft') &&
      !hasCapability(access, 'content.review')
    ) {
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'Content workspace access is not assigned.',
        },
      })
    }
    const record = await getLiveContentRecord(
      String(req.params.contentType || ''),
      String(req.params.slug || ''),
    )
    res.json(record)
  } catch (error) {
    if (!sendContentWorkflowError(res, error)) next(error)
  }
})

router.patch('/content/live/:contentType/:slug', async (req, res, next) => {
  try {
    const account = await requireAccount(req, res)
    if (!account || !requireVerified(req, res)) return
    const access = await getAccessProfile(account)
    const mode =
      String(req.body?.mode || 'draft') === 'apply' ? 'apply' : 'draft'
    const groupSlugs = listGroups().map((group) => group.slug)
    if (mode === 'apply') {
      if (
        !hasCapability(access, 'content.review') ||
        !hasCapability(access, 'content.publish')
      ) {
        return res.status(403).json({
          error: {
            code: 'forbidden',
            message: 'Apply mode requires content.review and content.publish.',
          },
        })
      }
      const result = await applyLiveContentUpdate({
        contentType: String(req.params.contentType || ''),
        slug: String(req.params.slug || ''),
        payload: req.body?.payload,
        actorId: account.id,
        groupSlugs,
      })
      await recordAudit({
        actorId: account.id,
        action: 'content.live_applied',
        targetType: result.contentType,
        targetId: result.slug,
        before: result.before,
        after: result.after,
        requestId: req.requestId,
      })
      return res.json(result)
    }
    if (!hasCapability(access, 'content.draft')) {
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message:
            'This content responsibility is not assigned to your account.',
        },
      })
    }
    const item = await draftLiveContentUpdate({
      contentType: String(req.params.contentType || ''),
      slug: String(req.params.slug || ''),
      payload: req.body?.payload,
      actorId: account.id,
      groupSlugs,
    })
    await recordAudit({
      actorId: account.id,
      action: 'content.live_draft_created',
      targetType: 'content_revision',
      targetId: item.id,
      after: {
        contentType: item.contentType,
        contentKey: item.contentKey,
        status: item.status,
        mode: 'draft',
      },
      requestId: req.requestId,
    })
    res.status(201).json({ mode: 'draft', item })
  } catch (error) {
    if (!sendContentWorkflowError(res, error)) next(error)
  }
})

router.post(
  '/content/live/:contentType/:slug/unpublish',
  async (req, res, next) => {
    try {
      const account = await requireAccount(req, res)
      if (!account || !requireVerified(req, res)) return
      if (!(await requireCapability(req, res, 'content.publish'))) return
      const result = await unpublishLiveContent({
        contentType: String(req.params.contentType || ''),
        slug: String(req.params.slug || ''),
        actorId: account.id,
        reason: req.body?.reason,
      })
      await recordAudit({
        actorId: account.id,
        action: 'content.unpublished',
        targetType: result.contentType,
        targetId: result.slug,
        before: result.before,
        after: {
          unpublished: true,
          status: result.publication?.status,
        },
        reason: result.reason,
        requestId: req.requestId,
      })
      res.json(result)
    } catch (error) {
      if (!sendContentWorkflowError(res, error)) next(error)
    }
  },
)

router.post('/content/drafts/:id/publish', async (req, res, next) => {
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
