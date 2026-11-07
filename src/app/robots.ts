import type { MetadataRoute } from 'next'
import { appBaseUrl } from '../lib/env'
import { PRIVATE_PATHS, isIndexable } from './(site)/seo'

// crawlers may fetch previews: blocking them here would hide the noindex
// metadata that keeps preview pages out of search results
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    ...(isIndexable() ? { sitemap: `${appBaseUrl()}/sitemap.xml` } : {}),
  }
}
