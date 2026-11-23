import config from '@payload-config'
import { getPayload } from 'payload'

/** Documents the public site needs on first paint; only these slugs are ever embedded in the HTML. */
export const PUBLIC_SITE_DOCUMENTS = ['site', 'connect', 'membership-policy'] as const

/**
 * Loads public CMS documents on the server, keyed the way the browser's SWR cache keys them
 * (`/documents/<slug>`), so the page renders its real content in the first HTML instead of
 * waiting for a client request. Fails soft: with no database yet (a CI build runs before
 * migrations) it returns nothing and the page falls back to fetching in the browser.
 */
export async function loadPublicDocuments(
  slugs: readonly string[] = PUBLIC_SITE_DOCUMENTS,
): Promise<Record<string, { slug: string; title: string; body: unknown }>> {
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'content-documents',
      where: { slug: { in: [...slugs] } },
      limit: slugs.length,
      depth: 0,
      pagination: false,
    })
    return Object.fromEntries(
      docs.map((doc) => [
        `/documents/${doc.slug}`,
        { slug: doc.slug, title: doc.title, body: doc.body },
      ]),
    )
  } catch {
    return {}
  }
}
