import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent, sentryDataCollection } from './lib/sentry'

// Server runtime (Next route handlers, Payload endpoints, the outbox drain).
// Disabled without SENTRY_DSN — self-hosted installs opt in via environment.
Sentry.init({
  enabled: Boolean(process.env.SENTRY_DSN),
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || 'development',
  dataCollection: sentryDataCollection,
  tracesSampleRate: 0,
  beforeSend: scrubSentryEvent,
})
