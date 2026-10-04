import type { PayloadRequest } from 'payload'
import type { Doc, AnyValue } from './domain'

// Content documents carry console-editable structured content (onboarding,
// policies, contact lists). The SPA fetches them via GET /api/documents/:slug.
export async function getDocument(
  req: PayloadRequest,
  slug: string,
): Promise<{ slug: string; title: string; body: AnyValue } | null> {
  const { docs } = await req.payload.find({
    collection: 'content-documents' as never,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    pagination: false,
    req,
  })
  const doc = docs[0] as Doc
  return doc ? { slug: doc.slug, title: doc.title, body: doc.body } : null
}
