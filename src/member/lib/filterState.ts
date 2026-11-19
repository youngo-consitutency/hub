/** Whether a catalogue filter is off, requiring a value, or excluding it. */
export type FilterState = 'neutral' | 'include' | 'exclude'

/** The active filters of one facet, keyed by value; a value that is off has no entry. */
export type FilterMap = Record<string, Exclude<FilterState, 'neutral'>>

function nextFilterState(current: FilterState = 'neutral'): FilterState {
  if (current === 'neutral') return 'include'
  if (current === 'include') return 'exclude'
  return 'neutral'
}

export function toggleFilter(filters: FilterMap, key: string): FilterMap {
  const next = { ...filters }
  const state = nextFilterState(next[key])
  if (state === 'neutral') delete next[key]
  else next[key] = state
  return next
}

export function matchesFilters(value: string | null | undefined, filters: FilterMap): boolean {
  const entries = Object.entries(filters)
  const included = entries.filter(([, state]) => state === 'include').map(([key]) => key)
  const excluded = entries.filter(([, state]) => state === 'exclude').map(([key]) => key)

  if (value != null && excluded.includes(value)) return false
  return included.length === 0 || (value != null && included.includes(value))
}

export function activeFilterCount(filters: FilterMap): number {
  return Object.keys(filters).length
}
