'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { ErrorCard, PageHeader } from './ui'

// shared body for the route-level error boundaries; scrubbing happens in beforeSend
export function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])
  return (
    <div>
      <PageHeader title="Something went wrong" />
      <ErrorCard
        message="This page hit a problem. Your work elsewhere is safe. Please try again, or reload if it keeps happening."
        onRetry={retry}
      />
    </div>
  )
}
