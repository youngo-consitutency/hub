import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

// Errors thrown inside nested React Server Components / route handlers that
// Next swallows before Sentry's own hooks see them.
export const onRequestError = Sentry.captureRequestError
