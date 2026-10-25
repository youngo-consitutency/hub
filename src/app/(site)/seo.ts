import type { Metadata } from 'next'

export const SITE_NAME = 'YOUNGO Hub'
export const SITE_DESCRIPTION =
  'YOUNGO Hub brings the work of the UNFCCC children and youth constituency into one shared platform — meetings, working groups, submissions, decisions, opportunities, and trusted knowledge.'
const SHARE_IMAGE = '/screenshots/home-wide.png'

export const isDemo = () =>
  process.env.NEXT_PUBLIC_HUB_DEMO === 'true' || process.env.HUB_DEMO_MODE === 'true'

export const shareMetadata = {
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
} satisfies Metadata

// Only public surfaces declare a canonical URL; member routes carry none, so
// crawlers never treat a gated page as the source of a shared link.
export function publicPage(path: string): Metadata {
  return {
    alternates: { canonical: path },
    openGraph: { ...shareMetadata.openGraph, url: path },
  }
}

// Public routes listed in the sitemap; everything signed-in is disallowed.
export const PUBLIC_PATHS = [
  '/',
  '/about',
  '/about/working-groups',
  '/about/resources',
  '/about/gys',
  '/about/coy',
  '/about/faq',
  '/about/organisation',
  '/about/contact',
  '/privacy',
  '/join',
  '/signin',
  '/negotiations',
  '/consultation',
  '/consultation/recap',
]

export const PRIVATE_PATHS = [
  '/account',
  '/admin',
  '/book',
  '/calendar',
  '/council',
  '/coys',
  '/cp',
  '/directory',
  '/focal',
  '/groups',
  '/gys',
  '/help',
  '/intelligence',
  '/landingV2',
  '/library',
  '/mail',
  '/membership',
  '/ngo',
  '/onboarding',
  '/opportunities',
  '/platform',
  '/profile',
  '/recognition',
  '/resources',
  '/search',
  '/staff',
  '/submissions',
  '/team',
  '/work',
  '/workspace',
]
