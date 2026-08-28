/**
 * Outward links and beta credits shown on the member home page.
 *
 * Add the real addresses below and they appear automatically — entries with an
 * empty `url` are skipped, so nothing unverified is ever published. Keep these
 * to official YOUNGO accounts only.
 */
export const SOCIAL_LINKS = [
  { key: 'website', label: 'youngo.uno', url: '' },
  {
    key: 'instagram',
    label: 'Instagram',
    url: 'https://www.instagram.com/youngo.unfccc',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    url: 'https://www.facebook.com/youngo.unfccc',
  },
  { key: 'x', label: 'X (IYCM)', url: 'https://twitter.com/IYCM' },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    url: 'https://www.linkedin.com/company/youngo-unfccc',
  },
  { key: 'youtube', label: 'YouTube', url: '' },
  { key: 'whatsapp', label: 'WhatsApp channel', url: '' },
]

export const publishedLinks = () => SOCIAL_LINKS.filter((link) => link.url)

/**
 * The two people who launched the Hub and keep it running. Names are shown as
 * written here; the Help page treats this as the complete maintainer list.
 */
export const HUB_LAUNCHERS = [
  {
    name: 'Jaloliddin Ismailov',
    focus: 'Product, engineering, policy & governance',
  },
  { name: 'Genaro Matías Godoy González', focus: 'Policy & governance' },
]
