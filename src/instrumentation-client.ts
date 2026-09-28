import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent } from './lib/sentry'

// Browser runtime — covers the member SPA (it mounts inside this bundle).
Sentry.init({
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    'development',
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrubSentryEvent,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
