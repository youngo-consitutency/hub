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

// Event types + resource taxonomy are staff-editable in the `content-options`
// document. Empty arrays until the document loads (or while it is unset).
export function useContentOptions() {
  const { doc } = useDocument('content-options')
  return {
    eventTypes: doc?.eventTypes || [],
    resourcePathways: doc?.resourcePathways || [],
    resourceTypes: doc?.resourceTypes || [],
    resourceTopics: doc?.resourceTopics || [],
    resourceRegions: doc?.resourceRegions || [],
    resourceLanguages: doc?.resourceLanguages || [],
    teamLabels: doc?.teamLabels || [],
    assignmentLabels: doc?.assignmentLabels || [],
    wgActivityKinds: doc?.wgActivityKinds || [],
    resourceIssueKinds: doc?.resourceIssueKinds || [],
  }
}

// {value,label} lists become lookup maps: labels.teamLabels['membership_team'].
export function useContentOptionLabels() {
  const options = useContentOptions()
  const toMap = (items) =>
    Object.fromEntries((items || []).map((item) => [item.value, item.label]))
  return {
    teamLabels: toMap(options.teamLabels),
    assignmentLabels: toMap(options.assignmentLabels),
    wgActivityKinds: toMap(options.wgActivityKinds),
    resourceIssueKinds: toMap(options.resourceIssueKinds),
  }
}

// ── Pure helpers over fetched bodies ──────────────────────────────

export function publishedLinks(links) {
  return (links || []).filter((link) => link.url)
}

// Single {value,label} lookup used wherever an option list needs a display
// label (documents-driven vocab and local option constants alike).
export function optionLabel(items, value) {
  return items.find((item) => item.value === value)?.label || value
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
