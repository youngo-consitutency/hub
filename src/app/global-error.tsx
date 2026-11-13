'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// last resort: replaces the whole document, so it carries its own html, body and inline styles
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])
  return (
    <html lang="en-GB">
      <head>
        <title>Something went wrong | YOUNGO Hub</title>
      </head>
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '48px 16px' }}>
        <main style={{ maxWidth: 560, margin: '0 auto' }}>
          <h1>Something went wrong</h1>
          <p>The Hub hit a problem it could not recover from. Please try again.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ padding: '10px 16px', minHeight: 44, fontSize: 16 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
