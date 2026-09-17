import { Router } from 'express'
import { getSessionAccount } from '../lib/accounts.js'
import { bearerToken } from '../lib/security.js'
import {
  deleteFollow,
  getPublicDocumentVersion,
  getPublicTrack,
  listPublicCalls,
  listPublicTracks,
  putFollow,
} from '../lib/negotiations.js'
import {
  reviewDocumentExtraction,
  SourceIngestionError,
} from '../lib/negotiationSources.js'
import {
  appendAmendmentVersion,
  appendSubmissionVersion,
  confirmAmendmentReconciliation,
  ContributionError,
  createAmendment,
  createSubmissionProject,
  getAccessibleProject,
  listAccessibleProjects,
  suggestAmendmentReconciliation,
} from '../lib/negotiationContributions.js'

export const negotiationRouter = Router()

const notFound = (res) =>
  res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } })

function sendContributionError(res, error) {
  if (!(error instanceof ContributionError)) return false
  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
  })
  return true
}

async function requireVerifiedHuman(req, res) {
  const account = await getSessionAccount(bearerToken(req))
  if (!account)
    return res.status(401).json({
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    })
  if (!account.isVerified || account.principalType === 'service')
    return res.status(403).json({
      error: { code: 'forbidden', message: 'Verified member access required.' },
    })
  return account
}

// Fixed collection/resource routes must precede /:slug.
negotiationRouter.get('/calls', async (req, res, next) => {
  try {
    res.json(await listPublicCalls(req.query))
  } catch (error) {
    next(error)
  }
})

negotiationRouter.post('/projects', async (req, res, next) => {
  try {
    const account = await requireVerifiedHuman(req, res)
    if (!account || res.headersSent) return
    const project = await createSubmissionProject({ account, input: req.body })
    res.status(201).json({ project })
  } catch (error) {
    if (!sendContributionError(res, error)) next(error)
  }
})

negotiationRouter.get('/projects', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    const account = await requireVerifiedHuman(req, res)
    if (!account || res.headersSent) return
    const items = await listAccessibleProjects({ account })
    res.json({ items })
  } catch (error) {
    if (!sendContributionError(res, error)) next(error)
  }
})

negotiationRouter.get('/projects/:id', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    const account = await requireVerifiedHuman(req, res)
    if (!account || res.headersSent) return
    const project = await getAccessibleProject({
      account,
      projectId: req.params.id,
    })
    res.json({ project })
  } catch (error) {
    if (!sendContributionError(res, error)) next(error)
  }
})

negotiationRouter.post('/projects/:id/versions', async (req, res, next) => {
  try {
    const account = await requireVerifiedHuman(req, res)
    if (!account || res.headersSent) return
    const version = await appendSubmissionVersion({
      account,
      projectId: req.params.id,
      input: req.body,
    })
    res.status(201).json({ version })
  } catch (error) {
    if (!sendContributionError(res, error)) next(error)
  }
})

negotiationRouter.post('/amendments', async (req, res, next) => {
  try {
    const account = await requireVerifiedHuman(req, res)
    if (!account || res.headersSent) return
    const amendment = await createAmendment({ account, input: req.body })
    res.status(201).json({ amendment })
  } catch (error) {
    if (!sendContributionError(res, error)) next(error)
  }
})

negotiationRouter.post('/amendments/:id/versions', async (req, res, next) => {
  try {
    const account = await requireVerifiedHuman(req, res)
    if (!account || res.headersSent) return
    const version = await appendAmendmentVersion({
      account,
      amendmentId: req.params.id,
      input: req.body,
    })
    res.status(201).json({ version })
  } catch (error) {
    if (!sendContributionError(res, error)) next(error)
  }
})

negotiationRouter.post(
  '/amendments/:id/reconciliations',
  async (req, res, next) => {
    try {
      const account = await requireVerifiedHuman(req, res)
      if (!account || res.headersSent) return
      const reconciliation = await suggestAmendmentReconciliation({
        account,
        amendmentId: req.params.id,
        input: req.body,
      })
      res.status(201).json({ reconciliation })
    } catch (error) {
      if (!sendContributionError(res, error)) next(error)
    }
  },
)

negotiationRouter.post(
  '/amendments/:id/reconciliations/:reconciliationId/confirm',
  async (req, res, next) => {
    try {
      const account = await requireVerifiedHuman(req, res)
      if (!account || res.headersSent) return
      const reconciliation = await confirmAmendmentReconciliation({
        account,
        amendmentId: req.params.id,
        reconciliationId: req.params.reconciliationId,
        input: req.body,
      })
      res.json({ reconciliation })
    } catch (error) {
      if (!sendContributionError(res, error)) next(error)
    }
  },
)

negotiationRouter.get(
  '/documents/:id/versions/:versionId',
  async (req, res, next) => {
    try {
      const item = await getPublicDocumentVersion(
        req.params.id,
        req.params.versionId,
      )
      return item ? res.json(item) : notFound(res)
    } catch (error) {
      next(error)
    }
  },
)

negotiationRouter.post(
  '/documents/:id/versions/:versionId/extraction-reviews',
  async (req, res, next) => {
    try {
      const account = await requireVerifiedHuman(req, res)
      if (!account || res.headersSent) return
      const result = await reviewDocumentExtraction({
        account,
        documentId: req.params.id,
        versionId: req.params.versionId,
        expectedRevision: req.body?.expectedRevision,
        text: req.body?.text,
        method: req.body?.method,
        confidence: req.body?.confidence,
        note: req.body?.note,
        requestId: req.get('x-request-id'),
      })
      res.status(201).json({ extraction: result })
    } catch (error) {
      if (error instanceof SourceIngestionError) {
        const status =
          {
            database_required: 503,
            human_required: 403,
            review_scope_denied: 403,
            version_not_found: 404,
            revision_conflict: 409,
          }[error.code] || 422
        return res.status(status).json({
          error: { code: error.code, message: error.message },
        })
      }
      next(error)
    }
  },
)

negotiationRouter.get('/', async (req, res, next) => {
  try {
    res.json(await listPublicTracks(req.query))
  } catch (error) {
    next(error)
  }
})

negotiationRouter.put('/:slug/follow', async (req, res, next) => {
  try {
    const account = await requireVerifiedHuman(req, res)
    if (!account || res.headersSent) return
    const result = await putFollow({
      accountId: account.id,
      slug: req.params.slug,
      preferences: req.body,
    })
    if (!result) return notFound(res)
    if (result.unavailable)
      return res.status(503).json({
        error: {
          code: 'database_required',
          message: 'Following requires persistent storage.',
        },
      })
    res.json({ following: true, preferences: result })
  } catch (error) {
    next(error)
  }
})

negotiationRouter.delete('/:slug/follow', async (req, res, next) => {
  try {
    const account = await requireVerifiedHuman(req, res)
    if (!account || res.headersSent) return
    const result = await deleteFollow({
      accountId: account.id,
      slug: req.params.slug,
    })
    if (result.unavailable)
      return res.status(503).json({
        error: {
          code: 'database_required',
          message: 'Following requires persistent storage.',
        },
      })
    res.json({ following: false })
  } catch (error) {
    next(error)
  }
})

negotiationRouter.get('/:slug', async (req, res, next) => {
  try {
    const item = await getPublicTrack(req.params.slug)
    return item ? res.json(item) : notFound(res)
  } catch (error) {
    next(error)
  }
})
