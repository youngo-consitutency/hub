import { useCallback } from 'react'
import { useApi } from './api'
import { replace } from './router'

/**
 * The open side panel lives in the URL (/groups/:slug), so it deep-links, survives a refresh and
 * closes with Back. `apiPath` is the record endpoint; the panel gets null until it loads.
 */
export function usePeek(listPath: string, apiPath: string, slug?: string) {
  const query = useApi(slug ? `${apiPath}/${slug}` : null)
  const close = useCallback(() => replace(listPath, { scroll: false }), [listPath])
  return { item: slug ? query.data : null, close }
}

/** Same, for records that only exist in a list the page already loaded (matched on `id`). */
export function usePeekFrom<T extends { id?: string | number }>(
  listPath: string,
  items: T[] | undefined,
  id?: string,
) {
  const close = useCallback(() => replace(listPath, { scroll: false }), [listPath])
  return { item: (id && items?.find((entry) => String(entry.id) === id)) || null, close }
}
