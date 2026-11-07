import type { MetadataRoute } from 'next'
import { appBaseUrl } from '../lib/env'
import { PUBLIC_PATHS, isIndexable } from './(site)/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexable()) return []
  const origin = appBaseUrl()
  return PUBLIC_PATHS.map((path) => ({ url: `${origin}${path}` }))
}
