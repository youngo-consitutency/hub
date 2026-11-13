'use client'

import { useEffect } from 'react'
import { NotFound } from '../components/NotFound'
import { replace, usePath } from '../lib/router'
import { matchHubRoute } from './routes'

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
  return <Page {...props} />
}
