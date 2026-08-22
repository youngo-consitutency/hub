export function nextFilterState(current = 'neutral') {
  if (current === 'neutral') return 'include'
  if (current === 'include') return 'exclude'
  return 'neutral'
}

export function toggleFilter(filters, key) {
  const next = { ...filters }
  const state = nextFilterState(next[key])
  if (state === 'neutral') delete next[key]
  else next[key] = state
  return next
}

export function matchesFilters(value, filters) {
  const entries = Object.entries(filters)
  const included = entries
    .filter(([, state]) => state === 'include')
    .map(([key]) => key)
  const excluded = entries
    .filter(([, state]) => state === 'exclude')
    .map(([key]) => key)

  if (excluded.includes(value)) return false
  return included.length === 0 || included.includes(value)
}

export function activeFilterCount(filters) {
  return Object.keys(filters).length
}
