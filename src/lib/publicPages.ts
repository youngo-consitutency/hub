import type { PayloadRequest } from 'payload'
import type { AnyValue, Doc } from './domain'
import { ApiError } from './respond'
import { audit } from './audit'
import { getDocument } from './documents'
import { baselinePage, publicPageDocument } from '../shared/publicPages'

// Publication of the reviewed FAQ / contact pages. Each page's live state is
// one content-document, `page-<slug>`; publishing and withdrawing hold a
// transaction-scoped advisory lock per page, and the audit row is written
// inside the same transaction, so a failed audit rolls the change back.
const PAGE_LOCK_NS = 0x594f50 // 'YOP'
const PAGE_LOCK_KEY: Record<string, number> = { faq: 1, contact: 2 }
const pageDocSlug = (slug: string) => `page-${slug}`

export type PageState = {
  state: 'baseline' | 'published' | 'unpublished'
  revisionId: number | null
  publishedAt: string | null
  document: Doc
}

export async function readPublicPage(req: PayloadRequest, slug: string): Promise<PageState> {
  const live = await getDocument(req, pageDocSlug(slug))
  if (live?.body?.state === 'published' || live?.body?.state === 'unpublished') {
    return {
      state: live.body.state,
      revisionId: live.body.revisionId ?? null,
      publishedAt: live.body.publishedAt ?? null,
      document: live.body.document,
    }
  }
  const site = await getDocument(req, 'site')
  return {
    state: 'baseline',
    revisionId: null,
    publishedAt: null,
    document: baselinePage(slug, site?.body),
  }
}

async function withPageLock<T>(req: PayloadRequest, slug: string, fn: () => Promise<T>) {
  const transactionID = await req.payload.db.beginTransaction()
  if (transactionID == null) throw new Error('Database transactions are unavailable.')
  req.transactionID = transactionID
  try {
    const db = (req.payload.db as Doc).sessions?.[transactionID]?.db
    await (req.payload.db as Doc).execute({
      db,
      raw: `SELECT pg_advisory_xact_lock(${PAGE_LOCK_NS}, ${PAGE_LOCK_KEY[slug]})`,
    })
    const result = await fn()
    await req.payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await req.payload.db.rollbackTransaction(transactionID)
    throw error
  } finally {
    delete req.transactionID
  }
}

async function writePageState(req: PayloadRequest, slug: string, body: Doc) {
  const { docs } = await req.payload.find({
    collection: 'content-documents',
    where: { slug: { equals: pageDocSlug(slug) } },
    limit: 1,
    overrideAccess: true,
    req,
  })
  const data = { slug: pageDocSlug(slug), title: `Public page: ${slug}`, body }
  if (docs[0])
    await req.payload.update({
      collection: 'content-documents',
      id: docs[0].id,
      data,
      overrideAccess: true,
      req,
    })
  else
    await req.payload.create({ collection: 'content-documents', data, overrideAccess: true, req })
}

/**
 * Publish an approved page draft. Refuses when the live page moved on since
 * the draft was written (a newer publish or a withdrawal), so an approved
 * draft can never silently overwrite someone else's published change.
 */
export async function publishPublicPage(req: PayloadRequest, draft: Doc, account: AnyValue) {
  const slug = draft.contentKey
  return withPageLock(req, slug, async () => {
    const current = await readPublicPage(req, slug)
    const base = draft.payload
    if (
      current.revisionId !== (base.baseRevisionId ?? null) ||
      current.state !== base.basePublicationStatus
    )
      throw new ApiError(
        409,
        'stale_target',
        'The live page changed after this draft was written. Start a new draft from the current page.',
      )
    const publishedAt = new Date().toISOString()
    await writePageState(req, slug, {
      state: 'published',
      revisionId: draft.id,
      publishedAt,
      document: publicPageDocument(base),
    })
    const updated = await req.payload.update({
      collection: 'content-drafts',
      id: draft.id,
      data: { status: 'published', publishedAt, revision: (draft.revision || 1) + 1 },
      overrideAccess: true,
      req,
    })
    await audit(req, account, {
      action: 'content.published',
      targetType: 'page',
      targetId: slug,
      before: { state: current.state, revisionId: current.revisionId },
      after: { state: 'published', revisionId: draft.id },
    })
    return updated
  })
}

export async function unpublishPublicPage(
  req: PayloadRequest,
  slug: string,
  revisionId: number,
  reason: string,
  account: AnyValue,
) {
  return withPageLock(req, slug, async () => {
    const current = await readPublicPage(req, slug)
    if (current.state !== 'published' || current.revisionId !== revisionId)
      throw new ApiError(409, 'stale_target', 'This page is not live at that revision.')
    await writePageState(req, slug, {
      state: 'unpublished',
      revisionId,
      publishedAt: current.publishedAt,
      document: current.document,
    })
    await audit(req, account, {
      action: 'content.unpublished',
      targetType: 'page',
      targetId: slug,
      reason,
      before: { state: 'published', revisionId },
      after: { state: 'unpublished', revisionId },
    })
  })
}
