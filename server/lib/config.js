const LOCAL_APP_ORIGIN = 'http://localhost:5173'

export function appOrigin(env = process.env) {
  return String(env.APP_ORIGIN || LOCAL_APP_ORIGIN).replace(/\/$/, '')
}

export function validateRuntimeConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return

  const missing = ['DATABASE_URL', 'APP_ORIGIN'].filter(
    (name) => !String(env[name] || '').trim(),
  )
  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`,
    )
  }

  const origin = new URL(env.APP_ORIGIN)
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
    throw new Error('APP_ORIGIN must use HTTPS in production.')
  }

  if (String(env.EMAIL_ENABLED || '').toLowerCase() === 'true') {
    const emailMissing = [
      'SMTP_HOST',
      'EMAIL_FROM',
      'EMAIL_UNSUBSCRIBE_SECRET',
      'EMAIL_WEBHOOK_SECRET',
    ].filter((name) => !String(env[name] || '').trim())
    if (emailMissing.length) {
      throw new Error(
        `Missing required email environment variables: ${emailMissing.join(', ')}`,
      )
    }
    const port = Number(env.SMTP_PORT || 587)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT must be a valid TCP port.')
    }
    const perSecond = Number(env.EMAIL_MAX_PER_SECOND || 1)
    if (!Number.isFinite(perSecond) || perSecond <= 0 || perSecond > 100) {
      throw new Error('EMAIL_MAX_PER_SECOND must be between 0 and 100.')
    }
    const perDay = Number(env.EMAIL_MAX_PER_DAY || 500)
    if (!Number.isInteger(perDay) || perDay < 1 || perDay > 1_000_000) {
      throw new Error('EMAIL_MAX_PER_DAY must be a positive integer.')
    }
    const pollMs = Number(env.EMAIL_WORKER_POLL_MS || 15_000)
    if (!Number.isInteger(pollMs) || pollMs < 1_000) {
      throw new Error('EMAIL_WORKER_POLL_MS must be at least 1000.')
    }
  }
}
