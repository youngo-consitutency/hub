import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json, readBody, param } from '../lib/respond'
import { requireVerifiedMember } from '../lib/accounts'
import { getAccessProfile, hasCapability } from '../lib/access'
import * as store from '../lib/content'
import { rateLimit } from '../lib/rateLimit'
import { getDocument } from '../lib/documents'
import { slugify } from '../../spa/shared/slug'
import { audit } from '../lib/audit'
import type { AccountLike, Doc, DocData } from '../lib/domain'

const canReview = async (req: PayloadRequest, account: AccountLike) => {
  const access = await getAccessProfile(req, account)
  return hasCapability(access, 'content.review')
}

const submissionLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  scope: 'resource-submit',
})

const resourceSlug = slugify

const draftView = (d: any) => ({
  id: d.id,
  contentType: d.contentType,
  contentKey: d.contentKey,
  status: d.status,
  payload: d.payload,
  authorId: typeof d.author === 'object' ? d.author?.id : d.author,
  reviewNote: d.reviewNote || null,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
})

async function checkDuplicateUrl(req: PayloadRequest, url: string, exceptSlug?: string) {
  if (!url) return
  const target = String(url).trim().toLowerCase()
  const items = await store.listResources(req)
  const hit = items.find(
    (r: any) => String(r.url || '').toLowerCase() === target && r.slug !== exceptSlug,
  )
  if (hit)
    throw fail.validation({
      url: 'This link is already in the catalogue. Report an issue or suggest a correction on its resource card.',
    })
}

async function requireResource(req: PayloadRequest, slug: string) {
  const items = await store.listResources(req)
  const item = items.find((r: any) => r.slug === slug)
  if (!item) throw fail.notFound('Resource not found.')
  return item
}

export const resourceEndpoints: Endpoint[] = [
  {
    path: '/member/resources/submissions/mine',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const { docs } = await req.payload.find({
        collection: 'content-drafts',
        where: {
          author: { equals: account.id },
          contentType: { equals: 'resource' },
        },
        sort: '-updatedAt',
        limit: 200,
        overrideAccess: true,
      })
      return json({ items: docs.map(draftView) })
    }),
  },
  {
    path: '/member/resources/submissions',
    method: 'post',
    handler: endpoint(async (req) => {
      await submissionLimit(req)
      const account = requireVerifiedMember(req)
      const b = await readBody(req)
      await checkDuplicateUrl(req, b.url)
      const slug = resourceSlug(b.title)
      if (!slug) throw fail.validation({ title: 'A title is required.' })
      const draft = await req.payload.create({
        collection: 'content-drafts',
        data: {
          contentType: 'resource',
          contentKey: slug,
          payload: { ...b, slug },
          author: account.id,
          status: 'in_review',
        } as DocData,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'resource.submitted',
        targetType: 'content_revision',
        targetId: String(draft.id),
      })
      return json({ item: draftView(draft) }, { status: 201 })
    }),
  },
  {
    path: '/member/resources/submissions/:id',
    method: 'patch',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const draft = (await req.payload.findByID({
        collection: 'content-drafts',
        id: param(req, 'id'),
        overrideAccess: true,
        req,
      })) as Doc
      if (!draft || draft.contentType !== 'resource')
        throw fail.notFound('Resource submission not found.')
      if (
        String(typeof draft.author === 'object' ? draft.author.id : draft.author) !==
        String(account.id)
      )
        throw fail.forbidden('Only the author can edit this submission.')
      const b = await readBody(req)
      await checkDuplicateUrl(req, b.url, draft.contentKey)
      const updated = await req.payload.update({
        collection: 'content-drafts',
        id: draft.id,
        data: {
          payload: { ...b, slug: draft.contentKey },
          status: 'in_review',
          revision: (draft.revision || 1) + 1,
        } as DocData,
        overrideAccess: true,
        req,
      })
      return json({ item: draftView(updated) })
    }),
  },
  {
    path: '/member/resources/issues',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await canReview(req, account)))
        throw fail.forbidden('This content responsibility is not assigned to your account.')
      const [items, issues, reviews, submissions] = await Promise.all([
        store.listResources(req),
        req.payload.find({
          collection: 'resource-issues',
          where: { resolvedAt: { exists: false } },
          sort: 'createdAt',
          limit: 500,
          overrideAccess: true,
        }),
        req.payload.find({
          collection: 'resource-reviews',
          sort: '-createdAt',
          limit: 500,
          overrideAccess: true,
          depth: 1,
        }),
        req.payload.find({
          collection: 'content-drafts',
          where: {
            contentType: { equals: 'resource' },
            status: { in: ['in_review', 'approved'] },
          },
          sort: '-updatedAt',
          limit: 500,
          overrideAccess: true,
        }),
      ])
      const latestReviewBySlug = new Map<string, Doc>()
      for (const r of reviews.docs as Doc[]) {
        if (!latestReviewBySlug.has(r.resourceSlug)) latestReviewBySlug.set(r.resourceSlug, r)
      }
      return json({
        items,
        issues: (issues.docs as Doc[]).map((i) => ({
          id: i.id,
          resourceSlug: i.resourceSlug,
          kind: i.kind,
          detail: i.detail,
          createdAt: i.createdAt,
        })),
        reviews: [...latestReviewBySlug.values()].map((r) => ({
          resourceSlug: r.resourceSlug,
          status: r.status,
          note: r.note,
          reviewedAt: r.createdAt,
          reviewerName: typeof r.reviewedBy === 'object' ? r.reviewedBy?.name : null,
        })),
        submissions: submissions.docs.map(draftView),
      })
    }),
  },
  {
    path: '/member/resources/:slug/issues',
    method: 'post',
    handler: endpoint(async (req) => {
      await submissionLimit(req)
      const account = requireVerifiedMember(req)
      const slug = param(req, 'slug')
      await requireResource(req, slug)
      const b = await readBody(req)
      const detail = String(b.detail || '').trim()
      const options = await getDocument(req, 'content-options')
      const issueKinds = (options?.body?.resourceIssueKinds || []).map((k: any) => String(k.value))
      if (!issueKinds.includes(String(b.kind)) || detail.length < 8 || detail.length > 2000)
        throw fail.validation({
          detail: 'Choose an issue type and explain the concern in 8–2,000 characters.',
        })
      const dup = await req.payload.find({
        collection: 'resource-issues',
        where: {
          resourceSlug: { equals: slug },
          reportedBy: { equals: account.id },
          resolvedAt: { exists: false },
        },
        limit: 1,
        overrideAccess: true,
      })
      if (dup.docs[0])
        throw new ApiError(409, 'conflict', 'You already have an open report for this resource.')
      const item = await req.payload.create({
        collection: 'resource-issues',
        data: {
          resourceSlug: slug,
          kind: b.kind,
          detail,
          reportedBy: account.id,
        } as DocData,
        overrideAccess: true,
        req,
      })
      return json({ item }, { status: 201 })
    }),
  },
  {
    path: '/member/resources/:slug/verify',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (!(await canReview(req, account)))
        throw fail.forbidden('This content responsibility is not assigned to your account.')
      const slug = param(req, 'slug')
      const b = await readBody(req)
      const note = String(b.note || '').trim()
      if (
        !['verified', 'needs_changes', 'retired'].includes(b.status) ||
        note.length < 8 ||
        note.length > 2000
      )
        throw fail.validation({
          note: 'Choose a result and leave a review note of 8–2,000 characters.',
        })
      if (
        b.status === 'verified' &&
        !['link', 'description', 'tags'].every((k) => b.checks?.[k] === true)
      )
        throw fail.validation({
          checks: 'Check the destination, description, and tags before marking a link verified.',
        })
      const resolvedIssueIds = Array.isArray(b.resolvedIssueIds)
        ? b.resolvedIssueIds.filter((id: unknown) => typeof id === 'string')
        : []
      const resource = await requireResource(req, slug)
      if (resource.fingerprint && b.fingerprint && resource.fingerprint !== b.fingerprint)
        throw new ApiError(
          409,
          'conflict',
          'This resource changed. Reload it and review the current version.',
        )
      const review = await req.payload.create({
        collection: 'resource-reviews',
        data: {
          resourceSlug: slug,
          fingerprint: b.fingerprint || resource.fingerprint || null,
          status: b.status,
          note,
          checks: {
            link: b.checks?.link === true,
            description: b.checks?.description === true,
            tags: b.checks?.tags === true,
          },
          reviewedBy: account.id,
        } as DocData,
        overrideAccess: true,
        req,
      })
      if (b.status !== 'needs_changes' && resolvedIssueIds.length) {
        for (const id of resolvedIssueIds.slice(0, 200)) {
          try {
            const issue = (await req.payload.findByID({
              collection: 'resource-issues',
              id,
              overrideAccess: true,
              req,
            })) as Doc
            if (issue && issue.resourceSlug === slug && !issue.resolvedAt) {
              await req.payload.update({
                collection: 'resource-issues',
                id,
                data: {
                  resolvedAt: new Date().toISOString(),
                  resolvedBy: account.id,
                  reviewId: String(review.id),
                } as DocData,
                overrideAccess: true,
                req,
              })
            }
          } catch {
            /* non-existent ids are skipped */
          }
        }
      }
      if (['verified', 'needs_changes', 'retired'].includes(b.status)) {
        const res = (
          await req.payload.find({
            collection: 'catalogue-resources',
            where: { slug: { equals: slug } },
            limit: 1,
            overrideAccess: true,
          })
        ).docs[0] as Doc
        if (res) {
          await req.payload.update({
            collection: 'catalogue-resources',
            id: res.id,
            data: {
              verificationStatus:
                b.status === 'needs_changes'
                  ? 'flagged'
                  : b.status === 'retired'
                    ? 'retired'
                    : 'verified',
              checkedAt: new Date().toISOString(),
              retiredAt: b.status === 'retired' ? new Date().toISOString() : null,
            } as DocData,
            overrideAccess: true,
            req,
          })
        }
      }
      await audit(req, account, {
        action: 'resource.verified_review',
        targetType: 'resource_review',
        targetId: String(review.id),
        after: { resourceSlug: slug, status: b.status },
      })
      return json({ item: review })
    }),
  },
  {
    path: '/member/resources/:slug/corrections',
    method: 'post',
    handler: endpoint(async (req) => {
      await submissionLimit(req)
      const account = requireVerifiedMember(req)
      const slug = param(req, 'slug')
      await requireResource(req, slug)
      const b = await readBody(req)
      await checkDuplicateUrl(req, b.url, slug)
      const draft = await req.payload.create({
        collection: 'content-drafts',
        data: {
          contentType: 'resource',
          contentKey: slug,
          payload: { ...b, slug },
          author: account.id,
          status: 'in_review',
        } as DocData,
        overrideAccess: true,
        req,
      })
      return json({ item: draftView(draft) }, { status: 201 })
    }),
  },
]
