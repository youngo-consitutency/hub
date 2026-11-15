// the public website's pages, defined once. the header, footer, mobile menu and sitemap read
// this list; plain data so the server-side sitemap can import it
//
// the paths avoid the Hub's own top-level names (/work, /resources, ...), which still redirect
// into /hub for old links

export interface SiteRoute {
  href: string
  label: string
  /** anchors inside the page, shown as the header dropdown and in the mobile menu */
  sections?: { href: string; label: string }[]
}

// four pages: the home page, then one per job. each long page is split into sections
export const SITE_ROUTES: SiteRoute[] = [
  { href: '/', label: 'Home' },
  {
    href: '/our-work',
    label: 'Our work',
    sections: [
      { href: '/our-work#working-groups', label: 'Working groups' },
      { href: '/our-work#conferences', label: 'Conferences' },
      { href: '/our-work#statement', label: 'Global Youth Statement' },
    ],
  },
  { href: '/learn', label: 'Resources' },
  {
    href: '/about',
    label: 'About',
    sections: [
      { href: '/about#organisation', label: 'Organisation' },
      { href: '/about#faq', label: 'Questions' },
      { href: '/about#contact', label: 'Contact' },
    ],
  },
]

// pages that moved or were merged keep working: old path -> where its content lives now
export const LEGACY_SITE_PATHS: Record<string, string> = {
  '/about/work': '/our-work',
  '/about/resources': '/learn',
  '/about/organisation': '/about',
  '/about/working-groups': '/our-work#working-groups',
  '/about/coy': '/our-work#conferences',
  '/about/gys': '/our-work#statement',
  '/about/faq': '/about#faq',
  '/about/contact': '/about#contact',
}

export const isSiteHome = (path: string) => path === '/'

export const isSiteRouteActive = (path: string, href: string) =>
  href === '/' ? isSiteHome(path) : path === href || path.startsWith(`${href}/`)

// anything the public site renders, including old paths that are about to move
export const isSitePath = (path: string) =>
  SITE_ROUTES.some(({ href }) => isSiteRouteActive(path, href)) || path.startsWith('/about/')

// every indexable public page: the site plus the standalone public entries
export const PUBLIC_PATHS = [
  ...SITE_ROUTES.map((route) => route.href),
  '/privacy',
  '/join',
  '/signin',
  '/negotiations',
]
