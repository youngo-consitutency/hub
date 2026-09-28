import { useApi } from './api.js'

// Content documents are console-editable records (collection
// `content-documents`) fetched through GET /api/documents/:slug.
// Each body preserves the shape of the former spa/src/content module.

export function useDocument(slug) {
  const { data, error, loading, retry } = useApi(
    slug ? `/documents/${slug}` : null,
  )
  return { doc: data?.body ?? null, title: data?.title ?? null, error, loading, retry }
}

// ── Pure helpers over fetched bodies ──────────────────────────────

export function publishedLinks(links) {
  return (links || []).filter((link) => link.url)
}

export function policiesInCategory(policies, categoryId) {
  return (policies || []).filter((p) => p.category === categoryId)
}

export function getWgOnboarding(wgOnboarding, slug) {
  const base = wgOnboarding?.default || {}
  const specific = slug === 'default' ? {} : wgOnboarding?.[slug] || {}
  return {
    presentation: specific.presentation || base.presentation || null,
    rules: [...new Set([...(specific.rules || []), ...(base.rules || [])])],
  }
}

export function deckStyle(brand, defaults = {}) {
  const colours = { ...defaults, ...brand }
  return {
    '--jt-mint': colours.mint,
    '--jt-forest': colours.forest,
    '--jt-deep': colours.deep,
    '--jt-lime': colours.lime,
    '--jt-ink': colours.ink,
    '--jt-muted': colours.muted,
    '--jt-blob': colours.blob,
    '--jt-rule': colours.rule,
    '--jt-section-a': colours.sectionA,
    '--jt-section-b': colours.sectionB,
    '--jt-section-c': colours.sectionC,
    '--jt-section-d': colours.sectionD,
  }
}
