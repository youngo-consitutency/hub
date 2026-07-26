/**
 * Outward links and beta credits shown on the member home page.
 *
 * Add the real addresses below and they appear automatically — entries with an
 * empty `url` are skipped, so nothing unverified is ever published. Keep these
 * to official YOUNGO accounts only.
 */
export const SOCIAL_LINKS = [
  { key: 'website', label: 'youngo.uno', url: '' },
  { key: 'instagram', label: 'Instagram', url: '' },
  { key: 'linkedin', label: 'LinkedIn', url: '' },
  { key: 'x', label: 'X', url: '' },
  { key: 'youtube', label: 'YouTube', url: '' },
  { key: 'whatsapp', label: 'WhatsApp channel', url: '' },
]

export const publishedLinks = () => SOCIAL_LINKS.filter((link) => link.url)

/**
 * People shaping the Hub during the beta. Names are shown as written here.
 */
export const BETA_CONTRIBUTORS = ['Genn', 'Imran Shaik', 'Leticia']
