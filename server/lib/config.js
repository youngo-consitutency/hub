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
}
