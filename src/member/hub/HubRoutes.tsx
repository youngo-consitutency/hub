'use client'

import { useEffect } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { RouteError } from '../components/RouteError'
import { NotFound } from '../components/NotFound'
import { replace, usePath } from '../lib/router'
import { matchHubRoute } from './routes'

// Hub pages all live on /hub (hash routes), so Next's pathname-keyed error.tsx never resets after
// a crash. Keying the boundary by the hash path gives every navigation a clean slate.
const fallback = ({ error, resetErrorBoundary }: FallbackProps) => (
  <RouteError error={error} retry={resetErrorBoundary} />
)

// a chunk that fails to load after a deploy is fixed by one reload
function reloadOnStaleChunk(error: unknown) {
  if ((error as Error)?.name !== 'ChunkLoadError') return
  try {
    if (sessionStorage.getItem('hub-chunk-reload')) return
    sessionStorage.setItem('hub-chunk-reload', '1')
  } catch {
    return
  }
  window.location.reload()
}

// renders the page for the current hash path inside the signed-in shell
export function HubRoutes() {
  const path = usePath()
  const match = matchHubRoute(path)
  const to = match?.kind === 'redirect' ? match.to : null

  useEffect(() => {
    if (to) replace(to)
  }, [to])

  if (!match) return <NotFound />
  if (match.kind === 'redirect') return null
  const { Page, props } = match
  return (
    <ErrorBoundary key={path} fallbackRender={fallback} onError={reloadOnStaleChunk}>
      <Page {...props} />
    </ErrorBoundary>
  )
}
