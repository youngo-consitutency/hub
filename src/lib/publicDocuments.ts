import config from '@payload-config'
import { getPayload } from 'payload'

/** Documents the public site needs on first paint; only these slugs are ever embedded in the HTML. */
export const PUBLIC_SITE_DOCUMENTS = ['site', 'connect', 'membership-policy'] as const

/** How long a render waits for the preload before giving up and letting the browser fetch instead. */
const LOAD_TIMEOUT_MS = 3000

type PublicDocuments = Record<string, { slug: string; title: string; body: unknown }>

async function readDocuments(slugs: readonly string[]): Promise<PublicDocuments> {
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
}

/**
 * Loads public CMS documents on the server, keyed the way the browser's SWR cache keys them
 * (`/documents/<slug>`), so the page renders its real content in the first HTML instead of
 * waiting for a client request.
 *
 * It is an optimisation, so it must never stall or break a render: it fails soft, and gives up
 * after LOAD_TIMEOUT_MS. With no database yet (a CI build runs before migrations), or a stalled
 * connection, it returns nothing and the page falls back to fetching in the browser.
 */
export async function loadPublicDocuments(
  slugs: readonly string[] = PUBLIC_SITE_DOCUMENTS,
): Promise<PublicDocuments> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Loading public documents timed out')),
      LOAD_TIMEOUT_MS,
    )
  })
  try {
    return await Promise.race([readDocuments(slugs), timeout])
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}
