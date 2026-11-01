/**
 * Reviewed public pages (FAQ, contact). The baseline is derived from the
 * staff-editable `site` content document; an editor drafts a change, a
 * reviewer approves it and a publisher publishes it into `page-<slug>`.
 * Shared by the content endpoints and the public site.
 */

export const PUBLIC_PAGE_KEYS = Object.freeze(['faq', 'contact'])
export const PAGE_STATES = Object.freeze(['baseline', 'published', 'unpublished'])

const text = (value, min, max) =>
  typeof value === 'string' && value.trim().length >= min && value.length <= max
const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const only = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key))

/** @param {string} value */
function safeLink(value) {
  if (/^\/[a-z0-9/#-]*$/.test(value) && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

const slugId = (value, fallback) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback

/** Baseline page document from the `site` content document. */
export function baselinePage(slug, site) {
  if (slug === 'faq') {
    const faq = site?.faq || {}
    return {
      slug,
      title: faq.title || 'Frequently asked questions',
      intro: faq.lead || '',
      sections: (faq.items || []).map((item, i) => ({
        id: `faq-${i}`,
        title: item.q,
        body: item.a,
      })),
    }
  }
  const contact = site?.contact || {}
  return {
    slug,
    title: contact.title || 'Contact',
    intro: contact.lead || '',
    sections: (contact.routes || []).map((route, i) => ({
      id: slugId(route.title, `route-${i}`),
      title: route.title,
      body: route.body,
      ...(route.cta?.href ? { linkLabel: route.cta.label, linkUrl: route.cta.href } : {}),
    })),
  }
}

/**
 * Validate a page draft payload. `baseRevisionId` names the published
 * revision the draft was written against (null for the baseline), so a
 * publish can refuse a draft whose base has moved on.
 */
export function validatePublicPage(input) {
  /** @type {Record<string, string>} */
  const errors = {}
  if (
    !only(input, ['slug', 'title', 'intro', 'sections', 'baseRevisionId', 'basePublicationStatus'])
  )
    errors.payload = 'Only public page fields are allowed.'
  const value = object(input) ? input : {}
  if (!PUBLIC_PAGE_KEYS.includes(value.slug)) errors.slug = 'Choose FAQ or Contact.'
  if (!text(value.title, 3, 160)) errors.title = 'Enter a title between 3 and 160 characters.'
  if (!text(value.intro, 10, 1000))
    errors.intro = 'Enter an introduction between 10 and 1,000 characters.'
  const sections = Array.isArray(value.sections) ? value.sections : []
  const badSection = (section) =>
    !only(section, ['id', 'title', 'body', 'linkLabel', 'linkUrl']) ||
    !text(section.id, 1, 80) ||
    !/^[a-z0-9-]+$/.test(section.id) ||
    !text(section.title, 3, 160) ||
    !text(section.body, 10, 4000) ||
    (section.linkUrl != null && (!safeLink(section.linkUrl) || !text(section.linkLabel, 1, 80))) ||
    (section.linkLabel != null && section.linkUrl == null)
  if (
    sections.length < 1 ||
    sections.length > 30 ||
    sections.some(badSection) ||
    new Set(sections.map((s) => s.id)).size !== sections.length
  )
    errors.sections = 'Add 1–30 distinct sections with a title, text and valid links.'
  const baseRevisionId = value.baseRevisionId ?? null
  const basePublicationStatus =
    value.basePublicationStatus ?? (baseRevisionId == null ? 'baseline' : 'published')
  if (
    (baseRevisionId != null && !Number.isInteger(baseRevisionId)) ||
    !PAGE_STATES.includes(basePublicationStatus) ||
    (basePublicationStatus === 'baseline') !== (baseRevisionId == null)
  )
    errors.baseRevisionId = 'The source revision and publication state must match.'
  if (Object.keys(errors).length) return { ok: false, errors, value: null }
  return { ok: true, errors, value: { ...value, baseRevisionId, basePublicationStatus } }
}

/** The public part of a validated payload — no revision metadata. */
export function publicPageDocument(payload) {
  const { slug, title, intro, sections } = payload
  return { slug, title, intro, sections }
}
