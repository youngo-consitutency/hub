import { createHmac, timingSafeEqual } from 'node:crypto'
import { appOrigin } from './config.js'
import { OPTIONAL_EMAIL_CATEGORIES } from './notificationStore.js'

function secret(env) {
  const value = String(env.EMAIL_UNSUBSCRIBE_SECRET || '').trim()
  if (value) return value
  if (env.NODE_ENV === 'production') {
    throw new Error('EMAIL_UNSUBSCRIBE_SECRET is required in production.')
  }
  return 'youngo-development-unsubscribe-secret'
}

function signature(payload, env) {
  return createHmac('sha256', secret(env)).update(payload).digest('base64url')
}

export function createUnsubscribeToken(accountId, category, env = process.env) {
  if (!OPTIONAL_EMAIL_CATEGORIES.includes(category))
    throw new Error('Invalid unsubscribe category.')
  const payload = Buffer.from(
    JSON.stringify({ v: 1, accountId: String(accountId), category }),
  ).toString('base64url')
  return `${payload}.${signature(payload, env)}`
}

export function verifyUnsubscribeToken(token, env = process.env) {
  const [payload, supplied] = String(token || '').split('.')
  if (!payload || !supplied) return null
  const expected = signature(payload, env)
  const left = Buffer.from(supplied)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (
      parsed.v !== 1 ||
      !parsed.accountId ||
      !OPTIONAL_EMAIL_CATEGORIES.includes(parsed.category)
    )
      return null
    return { accountId: String(parsed.accountId), category: parsed.category }
  } catch {
    return null
  }
}

export function unsubscribeUrl(accountId, category, env = process.env) {
  const token = createUnsubscribeToken(accountId, category, env)
  return `${appOrigin(env)}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`
}
