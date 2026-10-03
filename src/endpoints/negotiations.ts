import type { Endpoint, PayloadRequest } from 'payload'
import { endpoint, fail, json, readBody, param } from '../lib/respond'
import { isVerifiedAccount, requireAccount } from '../lib/accounts'
import {
  getPublicTrack,
  getPublicDocumentVersion,
  listPublicCalls,
  listPublicTracks,
  putFollow,
  deleteFollow,
} from '../modules/negotiation/tracking'
import { reviewDocumentExtraction, SourceIngestionError } from '../modules/negotiation/sources'
import {
  createSubmissionProject,
  appendSubmissionVersion,
  getAccessibleProject,
  listAccessibleProjects,
} from '../modules/negotiation/contributionProjects'
import {
  createAmendment,
  appendAmendmentVersion,
} from '../modules/negotiation/contributionAmendments'
import type { Doc } from '../lib/domain'
import {
  confirmAmendmentReconciliation,
  suggestAmendmentReconciliation,
} from '../modules/negotiation/contributionReconciliation'

// ContributionError carries .status/.code on a plain Error — the endpoint
// wrapper in respond.ts already maps that shape.
function ingestionError(error: unknown) {
  if (!(error instanceof SourceIngestionError)) return null
  const status =
    {
      database_required: 503,
      human_required: 403,
      review_scope_denied: 403,
      version_not_found: 404,
      revision_conflict: 409,
    }[error.code] || 422
  return json({ error: { code: error.code, message: error.message } }, { status })
}

// Negotiation endpoints exclude service principals — agent actions go
// through the scoped proposal APIs instead.
function requireVerifiedHuman(req: PayloadRequest) {
  const account = requireAccount(req)
  if (!isVerifiedAccount(account) || account.principalType === 'service')
    throw fail.forbidden('Verified member access required.')
  return account
}

export const negotiationEndpoints: Endpoint[] = [
  // Fixed collection routes precede /:slug (matching legacy route order).
  {
    path: '/negotiations/calls',
    method: 'get',
    handler: endpoint(async (req) => {
      return json(await listPublicCalls(req.query as Doc))
    }),
  },
  {
    path: '/negotiations/projects',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const b = await readBody(req)
      const project = await createSubmissionProject({
        account,
        input: b,
      })
      return json({ project }, { status: 201 })
    }),
  },
  {
    path: '/negotiations/projects',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const items = await listAccessibleProjects({ account })
      return json({ items })
    }),
  },
  {
    path: '/negotiations/projects/:id',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const project = await getAccessibleProject({
        account,
        projectId: param(req, 'id'),
      })
      return json({ project })
    }),
  },
  {
    path: '/negotiations/projects/:id/versions',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const b = await readBody(req)
      const version = await appendSubmissionVersion({
        account,
        projectId: param(req, 'id'),
        input: b,
      })
      return json({ version }, { status: 201 })
    }),
  },
  {
    path: '/negotiations/amendments',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const b = await readBody(req)
      const amendment = await createAmendment({ account, input: b })
      return json({ amendment }, { status: 201 })
    }),
  },
  {
    path: '/negotiations/amendments/:id/versions',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const b = await readBody(req)
      const version = await appendAmendmentVersion({
        account,
        amendmentId: param(req, 'id'),
        input: b,
      })
      return json({ version }, { status: 201 })
    }),
  },
  {
    path: '/negotiations/amendments/:id/reconciliations',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const b = await readBody(req)
      const reconciliation = await suggestAmendmentReconciliation({
        account,
        amendmentId: param(req, 'id'),
        input: b,
      })
      return json({ reconciliation }, { status: 201 })
    }),
  },
  {
    path: '/negotiations/amendments/:id/reconciliations/:reconciliationId/confirm',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const b = await readBody(req)
      const reconciliation = await confirmAmendmentReconciliation({
        account,
        amendmentId: param(req, 'id'),
        reconciliationId: param(req, 'reconciliationId'),
        input: b,
      })
      return json({ reconciliation })
    }),
  },
  {
    path: '/negotiations/documents/:id/versions/:versionId',
    method: 'get',
    handler: endpoint(async (req) => {
      const item = await getPublicDocumentVersion(param(req, 'id'), param(req, 'versionId'))
      if (!item) throw fail.notFound('Not found.')
      return json(item)
    }),
  },
  {
    path: '/negotiations/documents/:id/versions/:versionId/extraction-reviews',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const b = await readBody(req)
      try {
        const result = await reviewDocumentExtraction({
          req,
          account,
          documentId: param(req, 'id'),
          versionId: param(req, 'versionId'),
          expectedRevision: Number(b.expectedRevision),
          text: String(b.text ?? ''),
          method: b.method,
          confidence: b.confidence,
          note: b.note,
          requestId: String(req.headers?.get?.('x-request-id') || '') || null,
        })
        return json({ extraction: result }, { status: 201 })
      } catch (error) {
        const handled = ingestionError(error)
        if (handled) return handled
        throw error
      }
    }),
  },
  {
    path: '/negotiations',
    method: 'get',
    handler: endpoint(async (req) => {
      return json(await listPublicTracks(req.query as Doc))
    }),
  },
  {
    path: '/negotiations/:slug/follow',
    method: 'put',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const b = await readBody(req)
      const result = await putFollow({
        accountId: account.id,
        slug: param(req, 'slug'),
        preferences: b,
      })
      if (!result) throw fail.notFound('Not found.')
      if ('unavailable' in result && result.unavailable)
        return json(
          {
            error: {
              code: 'database_required',
              message: 'Following requires persistent storage.',
            },
          },
          { status: 503 },
        )
      return json({ following: true, preferences: result })
    }),
  },
  {
    path: '/negotiations/:slug/follow',
    method: 'delete',
    handler: endpoint(async (req) => {
      const account = requireVerifiedHuman(req)
      const result = await deleteFollow({
        accountId: account.id,
        slug: param(req, 'slug'),
      })
      if (result && 'unavailable' in result && result.unavailable)
        return json(
          {
            error: {
              code: 'database_required',
              message: 'Following requires persistent storage.',
            },
          },
          { status: 503 },
        )
      return json({ following: false })
    }),
  },
  {
    path: '/negotiations/:slug',
    method: 'get',
    handler: endpoint(async (req) => {
      const item = await getPublicTrack(param(req, 'slug'))
      if (!item) throw fail.notFound('Not found.')
      return json(item)
    }),
  },
]
