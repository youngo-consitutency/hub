// the public website's pages, defined once. the header, mobile menu, footer and
// sitemap read this list; plain data so the server-side sitemap can import it

export type SiteMenu = 'takePart' | 'about'

export interface SiteRoute {
  href: string
  label: string
  // header placement: a top-level link, or an entry under one of the menus
  menu?: SiteMenu
}

export const SITE_ROUTES: SiteRoute[] = [
  { href: '/', label: 'Home' },
  { href: '/about/working-groups', label: 'Working groups' },
  { href: '/about/coy', label: 'COY', menu: 'takePart' },
  { href: '/about/gys', label: 'GYS', menu: 'takePart' },
  { href: '/about/resources', label: 'Resources', menu: 'takePart' },
  { href: '/about/organisation', label: 'Organisation & partners', menu: 'about' },
  { href: '/about/faq', label: 'FAQs', menu: 'about' },
  { href: '/about/contact', label: 'Contact', menu: 'about' },
]

export const SITE_MENUS: { id: SiteMenu; label: string }[] = [
  { id: 'takePart', label: 'Take part' },
  { id: 'about', label: 'About' },
]

// the home page is also served at /about; '/' is its canonical address
export const isSiteHome = (path: string) => path === '/' || path === '/about' || path === '/about/'

export const isSiteRouteActive = (path: string, href: string) =>
  href === '/' ? isSiteHome(path) : path === href || path.startsWith(`${href}/`)

// every indexable public page: the site plus the standalone public entries
export const PUBLIC_PATHS = [
  ...SITE_ROUTES.map((route) => route.href),
  '/privacy',
  '/join',
  '/signin',
  '/negotiations',
  '/consultation',
  '/consultation/recap',
]
