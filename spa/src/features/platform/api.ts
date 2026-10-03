import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, apiPatch } from '../../lib/api'

export const get = <T>(path: string): Promise<T> => apiGet(`/platform${path}`)
export const post = (path: string, body: unknown = {}) => apiPost(`/platform${path}`, body)
export const patch = (path: string, body: unknown) => apiPatch(`/platform${path}`, body)
export function usePlatform<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0)
  const loadedPath = useRef(path)
  const reload = useCallback(() => setRevision((n) => n + 1), [])
  useEffect(() => {
    let active = true
    if (loadedPath.current !== path) {
      setData(null)
      loadedPath.current = path
    }
    setLoading(true)
    setError('')
    get<T>(path)
      .then((value) => {
        if (active) setData(value)
      })
      .catch((error) => {
        if (active)
          setError(error instanceof Error ? error.message : 'Could not load the workspace.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [path, revision])
  return { data, error, loading, reload }
}
export function values(form: HTMLFormElement): Record<string, unknown> {
  const result: Record<string, unknown> = Object.fromEntries(new FormData(form))
  for (const name of [
    'version',
    'snapHours',
    'electorateSize',
    'votesFor',
    'votesAgainst',
    'vetoOrganisations',
    'vetoGlobalSouth',
    'vetoBodies',
  ])
    if (result[name] !== undefined && result[name] !== '') result[name] = Number(result[name])
  for (const name of ['startsAt', 'endsAt', 'dueAt', 'reviewDueAt', 'followUpAt', 'renewalDueAt'])
    if (typeof result[name] === 'string' && result[name])
      result[name] = new Date(result[name]).toISOString()
  return result
}
export { formatDateTime as formatDate } from '../../lib/time'
