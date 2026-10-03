import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json } from '../lib/respond'
import { isVerifiedAccount, requireAccount } from '../lib/accounts'
import { getAccessProfile, hasCapability } from '../lib/access'
import * as store from '../lib/content'
import { audit } from '../lib/audit'

/** Resolve the requesting account and its content draft/review/publish capabilities. */
async function draftAccess(req: PayloadRequest) {
  const account = requireAccount(req)
  if (!isVerifiedAccount(account))
    throw new ApiError(403, 'not_verified', 'Complete the membership course to use this feature.')
  const access = await getAccessProfile(req, account)
  const canDraft = hasCapability(access, 'content.draft')
  const canReview = hasCapability(access, 'content.review')
  const canPublish = hasCapability(access, 'content.publish')
  return { account, access, canDraft, canReview, canPublish }
}

const draftView = (d: any) => ({
  id: d.id,
  contentType: d.contentType,
  contentKey: d.contentKey,
  payload: d.payload,
  status: d.status,
  createdBy: typeof d.author === 'object' ? d.author?.id : d.author,
  creatorName:
    typeof d.author === 'object' ? d.author?.name || d.author?.displayName || null : null,
  creatorEmail: typeof d.author === 'object' ? d.author?.email : null,
  reviewedBy: typeof d.reviewer === 'object' ? d.reviewer?.id : d.reviewer,
  reviewerName:
    typeof d.reviewer === 'object' ? d.reviewer?.name || d.reviewer?.displayName || null : null,
  reviewNote: d.reviewNote || null,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
  submittedAt: d.submittedAt || null,
  reviewedAt: d.reviewedAt || null,
  publishedAt: d.publishedAt || null,
  revision: d.revision || 1,
})

async function getDraft(req: PayloadRequest, id: string) {
  try {
    const d = (await req.payload.findByID({
      collection: 'content-drafts',
      id,
      overrideAccess: true,
      depth: 1,
      req,
    })) as any
    if (!d) throw fail.notFound('Draft not found.')
    return d
  } catch (e: any) {
    if (e instanceof ApiError) throw e
    throw fail.notFound('Draft not found.')
  }
}

const contentKeyFor = (contentType: string, payload: any) =>
  String(payload?.slug || payload?.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

async function applyToLive(
  req: PayloadRequest,
  contentType: string,
  contentKey: string,
  payload: any,
) {
  if (contentType === 'event') {
    const { docs } = await req.payload.find({
      collection: 'content-events',
      where: { slug: { equals: contentKey } },
      limit: 1,
      overrideAccess: true,
    })
    const data = {
      slug: contentKey,
      title: payload.title,
      type: payload.type,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt || payload.startsAt,
      description: payload.description || '',
      workingGroup: payload.wgSlug
        ? (
            (
              await req.payload.find({
                collection: 'working-groups',
                where: { slug: { equals: payload.wgSlug } },
                limit: 1,
                overrideAccess: true,
              })
            ).docs[0] as any
          )?.id
        : null,
      meetingUrl: payload.meetingUrl || null,
      recordingUrl: payload.recordingUrl || null,
      state: 'published',
    }
    if (docs[0]) {
      return req.payload.update({
        collection: 'content-events',
        id: (docs[0] as any).id,
        data: data as any,
        overrideAccess: true,
        req,
      })
    }
    return req.payload.create({
      collection: 'content-events',
      data: data as any,
      overrideAccess: true,
      req,
    })
  }
  if (contentType === 'announcement') {
    const { docs } = await req.payload.find({
      collection: 'content-announcements',
      where: { slug: { equals: contentKey } },
      limit: 1,
      overrideAccess: true,
    })
    const data = {
      slug: contentKey,
      title: payload.title,
      kind: payload.kind || 'update',
      body: payload.body || '',
      state: payload.state || 'published',
      pinned: Boolean(payload.pinned),
    }
    if (docs[0]) {
      return req.payload.update({
        collection: 'content-announcements',
        id: (docs[0] as any).id,
        data: data as any,
        overrideAccess: true,
        req,
      })
    }
    return req.payload.create({
      collection: 'content-announcements',
      data: data as any,
      overrideAccess: true,
      req,
    })
  }
  if (contentType === 'resource') {
    const { docs } = await req.payload.find({
      collection: 'catalogue-resources',
      where: { slug: { equals: contentKey } },
      limit: 1,
      overrideAccess: true,
    })
    const data = {
      slug: contentKey,
      title: payload.title,
      category: payload.category || 'general',
      summary: payload.summary || '',
      url: payload.url || '',
      format: payload.format || 'link',
      verified: Boolean(payload.verified),
      state: 'published',
    }
    if (docs[0]) {
      return req.payload.update({
        collection: 'catalogue-resources',
        id: (docs[0] as any).id,
        data: data as any,
        overrideAccess: true,
        req,
      })
    }
    return req.payload.create({
      collection: 'catalogue-resources',
      data: data as any,
      overrideAccess: true,
      req,
    })
  }
  throw fail.validation({ contentType: 'Unsupported content type.' })
}

export const contentEndpoints: Endpoint[] = [
  {
    path: '/member/content',
    method: 'get',
    handler: endpoint(async (req) => {
      const { account, canDraft, canReview, canPublish } = await draftAccess(req)
      if (!canDraft && !canReview) throw fail.forbidden('Content workspace access is not assigned.')
      const { docs } = await req.payload.find({
        collection: 'content-drafts',
        where: canReview ? { status: { not_equals: 'draft' } } : { author: { equals: account.id } },
        sort: '-updatedAt',
        limit: 300,
        overrideAccess: true,
        depth: 1,
      })
      const groups = (await await store.listGroups(req)).map((g) => ({
        slug: g.slug,
        name: g.name,
      }))
      return json({
        permissions: { canDraft, canReview, canPublish },
        items: docs.map(draftView),
        publications: (docs as any[])
          .filter((d) => d.status === 'published')
          .map(draftView)
          .slice(0, 100),
        groups,
        live: {
          events: await store.listEvents(req),
          announcements: await store.listAnnouncements(req),
        },
      })
    }),
  },
  {
    path: '/member/content/drafts',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, canDraft } = await draftAccess(req)
      if (!canDraft) throw fail.forbidden('Content drafting is not assigned.')
      const b = ((await req.json?.()) || {}) as any
      const contentType = String(b.contentType || '')
      if (!['event', 'announcement', 'resource'].includes(contentType))
        throw fail.validation({ contentType: 'Choose events, announcements, or resources.' })
      const payload = b.payload || {}
      const contentKey = contentKeyFor(contentType, payload)
      if (!contentKey) throw fail.validation({ payload: 'A title is required.' })
      const created = await req.payload.create({
        collection: 'content-drafts',
        data: {
          contentType,
          contentKey,
          payload,
          author: account.id,
          status: 'draft',
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: draftView(created) }, { status: 201 })
    }),
  },
  {
    path: '/member/content/drafts/:id',
    method: 'patch',
    handler: endpoint(async (req) => {
      const { account, canDraft } = await draftAccess(req)
      if (!canDraft) throw fail.forbidden()
      const draft = await getDraft(req, String(req.routeParams?.id))
      if (String(draft.author?.id ?? draft.author) !== String(account.id))
        throw fail.forbidden('Only the author can edit this draft.')
      if (!['draft', 'changes_requested'].includes(draft.status))
        throw new ApiError(409, 'conflict', 'This draft is already in review.')
      const b = ((await req.json?.()) || {}) as any
      const updated = await req.payload.update({
        collection: 'content-drafts',
        id: draft.id,
        data: {
          payload: b.payload ?? draft.payload,
          revision: (draft.revision || 1) + 1,
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: draftView(updated) })
    }),
  },
  {
    path: '/member/content/drafts/:id/submit',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, canDraft } = await draftAccess(req)
      if (!canDraft) throw fail.forbidden()
      const draft = await getDraft(req, String(req.routeParams?.id))
      if (String(draft.author?.id ?? draft.author) !== String(account.id))
        throw fail.forbidden('Only the author can submit this draft.')
      if (!['draft', 'changes_requested'].includes(draft.status))
        throw new ApiError(409, 'conflict', 'This draft is already in review.')
      const updated = await req.payload.update({
        collection: 'content-drafts',
        id: draft.id,
        data: {
          status: 'in_review',
          submittedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: draftView(updated) })
    }),
  },
  {
    path: '/member/content/drafts/:id/review',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, canReview } = await draftAccess(req)
      if (!canReview) throw fail.forbidden('Content review is not assigned.')
      const draft = await getDraft(req, String(req.routeParams?.id))
      if (draft.status !== 'in_review')
        throw new ApiError(409, 'conflict', 'Only drafts in review can be decided.')
      if (String(draft.author?.id ?? draft.author) === String(account.id))
        throw fail.forbidden('Authors cannot review their own draft.')
      const b = ((await req.json?.()) || {}) as any
      const decision = ['approve', 'decline', 'request_changes'].includes(b.decision)
        ? b.decision
        : null
      if (!decision)
        throw fail.validation({ decision: 'Choose approve, decline, or request changes.' })
      const status =
        decision === 'approve'
          ? 'approved'
          : decision === 'decline'
            ? 'rejected'
            : 'changes_requested'
      const updated = await req.payload.update({
        collection: 'content-drafts',
        id: draft.id,
        data: {
          status,
          reviewer: account.id,
          reviewNote: String(b.reviewNote || '').slice(0, 2000),
          reviewedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: draftView(updated) })
    }),
  },
  {
    path: '/member/content/drafts/:id/publish',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, canPublish } = await draftAccess(req)
      if (!canPublish) throw fail.forbidden('Publishing is not assigned.')
      const draft = await getDraft(req, String(req.routeParams?.id))
      if (draft.status !== 'approved')
        throw new ApiError(409, 'conflict', 'Only approved drafts can be published.')
      if (String(draft.author?.id ?? draft.author) === String(account.id))
        throw fail.forbidden('Authors cannot publish their own draft.')
      await applyToLive(req, draft.contentType, draft.contentKey, draft.payload)
      const updated = await req.payload.update({
        collection: 'content-drafts',
        id: draft.id,
        data: {
          status: 'published',
          publishedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
        req,
      })
      return json({ item: draftView(updated) })
    }),
  },
  {
    path: '/member/content/live/:contentType/:slug',
    method: 'get',
    handler: endpoint(async (req) => {
      const { canDraft, canReview } = await draftAccess(req)
      if (!canDraft && !canReview) throw fail.forbidden()
      const contentType = String(req.routeParams?.contentType)
      const slug = String(req.routeParams?.slug)
      let item: any = null
      if (contentType === 'event') item = await store.getEvent(req, slug)
      else if (contentType === 'announcement') item = await store.getAnnouncement(req, slug)
      else if (contentType === 'resource')
        item = (await store.listResources(req)).find((r: any) => r.slug === slug)
      if (!item) throw fail.notFound()
      return json({ item })
    }),
  },
  {
    path: '/member/content/live/:contentType/:slug',
    method: 'patch',
    handler: endpoint(async (req) => {
      const { account, canPublish } = await draftAccess(req)
      if (!canPublish) throw fail.forbidden('Publishing is not assigned.')
      const contentType = String(req.routeParams?.contentType)
      const slug = String(req.routeParams?.slug)
      const b = ((await req.json?.()) || {}) as any
      const payload = b.payload ?? b
      const item = await applyToLive(req, contentType, slug, payload)
      await audit(req, account, {
        action: 'content.live_patch',
        targetType: contentType,
        targetId: slug,
      })
      return json({ item })
    }),
  },
  {
    // Takes a live item offline without deleting it — mirrors the legacy
    // publication status flip (member and public reads then return 404).
    path: '/member/content/live/:contentType/:slug/unpublish',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, canPublish } = await draftAccess(req)
      if (!canPublish) throw fail.forbidden('Publishing is not assigned.')
      const contentType = String(req.routeParams?.contentType)
      const slug = String(req.routeParams?.slug)
      if (!['event', 'announcement'].includes(contentType))
        throw fail.validation({
          contentType: 'contentType must be event or announcement.',
        })
      const collection = contentType === 'event' ? 'content-events' : 'content-announcements'
      const { docs } = await req.payload.find({
        collection,
        where: {
          and: [{ slug: { equals: slug } }, { state: { not_equals: 'unpublished' } }],
        },
        limit: 1,
        overrideAccess: true,
      })
      const live = docs[0] as any
      if (!live)
        throw new ApiError(404, 'not_found', `No live ${contentType} with slug "${slug}".`, {
          slug: `No live ${contentType} with slug "${slug}".`,
        })
      const before =
        contentType === 'event'
          ? {
              slug: live.slug,
              title: live.title,
              type: live.type,
              startsAt: live.startsAt,
              endsAt: live.endsAt,
              description: live.description || '',
              wg: live.wg?.slug || live.wg || '',
              meetingUrl: live.meetingUrl || '',
              recordingUrl: live.recordingUrl || '',
            }
          : {
              slug: live.slug,
              title: live.title,
              body: live.body,
              pinned: Boolean(live.pinned),
              ctaUrl: live.ctaUrl || '',
              ctaLabel: live.ctaLabel || '',
              ctaDeadlineAt: live.ctaDeadlineAt || '',
            }
      const b = ((await req.json?.()) || {}) as any
      const cleanReason =
        String(b.reason || '')
          .trim()
          .slice(0, 500) || null
      const now = new Date().toISOString()
      await req.payload.update({
        collection,
        id: live.id,
        data: { state: 'unpublished' } as any,
        overrideAccess: true,
        req,
      })
      const publication = {
        contentType,
        contentKey: live.slug,
        payload: before,
        status: 'unpublished',
        unpublishedBy: account.id,
        unpublishedAt: now,
        unpublishReason: cleanReason,
      }
      await audit(req, account, {
        action: 'content.unpublished',
        targetType: contentType,
        targetId: live.slug,
        before,
        after: { unpublished: true, status: 'unpublished' },
        reason: cleanReason,
      })
      return json({
        contentType,
        slug: live.slug,
        unpublished: true,
        publication,
        before,
        reason: cleanReason,
      })
    }),
  },
]
