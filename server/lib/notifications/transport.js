import nodemailer from 'nodemailer'
import { renderEmailTemplate } from './templates.js'

let cached = null
let cachedKey = null

export function emailConfigured(env = process.env) {
  const enabled = String(env.EMAIL_ENABLED || '').toLowerCase()
  if (
    enabled === 'false' ||
    (env.NODE_ENV === 'production' && enabled !== 'true')
  )
    return false
  return Boolean(
    String(env.SMTP_HOST || '').trim() && String(env.EMAIL_FROM || '').trim(),
  )
}

function transportKey(env) {
  return [
    env.SMTP_HOST,
    env.SMTP_PORT,
    env.SMTP_SECURE,
    env.SMTP_USER,
    env.SMTP_REQUIRE_TLS,
  ].join('|')
}

function transporter(env) {
  if (!emailConfigured(env)) {
    const error = new Error('Email delivery is not configured.')
    error.code = 'email_not_configured'
    throw error
  }
  const key = transportKey(env)
  if (cached && cachedKey === key) return cached
  const port = Number(env.SMTP_PORT || 587)
  const secure =
    String(env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465
  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    requireTLS:
      String(env.SMTP_REQUIRE_TLS || '').toLowerCase() === 'true' ||
      env.NODE_ENV === 'production',
    ...(env.SMTP_USER
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS || '' } }
      : {}),
    connectionTimeout: Number(env.SMTP_CONNECTION_TIMEOUT_MS || 10_000),
    greetingTimeout: Number(env.SMTP_GREETING_TIMEOUT_MS || 10_000),
    socketTimeout: Number(env.SMTP_SOCKET_TIMEOUT_MS || 20_000),
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  })
  cachedKey = key
  return cached
}

export function deliveryFailure(error) {
  const responseCode = Number(error?.responseCode || 0)
  const code = String(error?.code || responseCode || 'smtp_error').slice(0, 80)
  return {
    code,
    permanent:
      (responseCode >= 500 && responseCode < 600) ||
      ['recipient_not_allowlisted', 'email_not_configured'].includes(code),
  }
}

export async function sendTemplatedEmail({
  to,
  templateKey,
  data,
  unsubscribeUrl = null,
  messageId = null,
  env = process.env,
}) {
  const allowlist = String(env.EMAIL_RECIPIENT_ALLOWLIST || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  if (
    allowlist.length &&
    !allowlist.includes(String(to).trim().toLowerCase())
  ) {
    const error = new Error('Recipient is not in the email delivery allowlist.')
    error.code = 'recipient_not_allowlisted'
    throw error
  }
  const rendered = await renderEmailTemplate(templateKey, data, {
    unsubscribeUrl,
  })
  const headers = unsubscribeUrl
    ? {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }
    : {}
  const info = await transporter(env).sendMail({
    from: env.EMAIL_FROM,
    to,
    replyTo: env.EMAIL_REPLY_TO || undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers,
    messageId: messageId || undefined,
  })
  if (!info.accepted?.length) {
    const error = new Error('SMTP did not accept the recipient.')
    error.code = 'smtp_not_accepted'
    throw error
  }
  return { messageId: info.messageId || null }
}

export function resetEmailTransportForTests() {
  cached = null
  cachedKey = null
}
