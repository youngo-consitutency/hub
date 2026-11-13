import { useMemo, useState } from 'react'

export interface CatalogueOptions<T> {
  /** the text a search is matched against */
  text: (item: T) => unknown[]
  /** one predicate per filter key; an empty value means the filter is off */
  filters?: Record<string, (item: T, value: string) => boolean>
  /** most relevant first; the source order when omitted */
  sort?: (a: T, b: T) => number
  pageSize?: number
}

// the browse loop behind every long public list: search, filter, order, reveal a page at a time
export function useCatalogue<T>(
  items: T[],
  { text, filters = {}, sort, pageSize = 12 }: CatalogueOptions<T>,
) {
  const [search, setSearchValue] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [shown, setShown] = useState(pageSize)

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const found = items.filter(
      (item) =>
        Object.entries(filters).every(([key, test]) => !values[key] || test(item, values[key])) &&
        (!needle ||
          text(item).some((part) =>
            String(part ?? '')
              .toLowerCase()
              .includes(needle),
          )),
    )
    return sort ? found.sort(sort) : found
    // text, filters and sort are stable per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, values])

  // any change to what is searched or filtered starts again from the first page
  const setSearch = (value: string) => {
    setSearchValue(value)
    setShown(pageSize)
  }
  const setFilter = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setShown(pageSize)
  }
  const reset = () => {
    setSearchValue('')
    setValues({})
    setShown(pageSize)
  }

  return {
    search,
    setSearch,
    values,
    setFilter,
    reset,
    matches,
    visible: matches.slice(0, shown),
    remaining: Math.max(0, matches.length - shown),
    showMore: () => setShown((count) => count + pageSize),
    pageSize,
  }
}
