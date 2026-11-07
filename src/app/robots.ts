import type { MetadataRoute } from 'next'
import { appBaseUrl } from '../lib/env'
import { PRIVATE_PATHS, isIndexable } from './(site)/seo'

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    sitemap: `${appBaseUrl()}/sitemap.xml`,
  }
}
