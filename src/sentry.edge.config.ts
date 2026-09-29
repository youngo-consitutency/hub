import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent } from './lib/sentry'

// Edge runtime — same policy as the server config (no PII, errors only).
Sentry.init({
  enabled: Boolean(process.env.SENTRY_DSN),
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || 'development',
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrubSentryEvent,
})
