import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import nodemailer, { type Transporter } from 'nodemailer'
import { defaultEmailFrom } from './env'
import { deliveryDisabled } from './environment'
// Outbound email. Mirrors EMAIL_* / SMTP_* envs from the legacy service; when
// unconfigured, messages are logged and dropped (delivery-failure pattern from
// server/lib/notifications/transport.js).
export function emailConfigured(): boolean {
  return (
    !deliveryDisabled() &&
    Boolean(process.env.SMTP_URL || (process.env.SMTP_HOST && process.env.EMAIL_FROM))
  )
}

let transporter: Transporter | null = null

// Shared transport — payload.config.ts wires the same connection into
// Payload's nodemailer adapter so console emails use identical SMTP settings.
// Bound every phase of the SMTP exchange — the outbox worker must not hang a
// whole batch on an unresponsive gateway.
const SMTP_TIMEOUTS = {
  connectionTimeout: 20_000,
  greetingTimeout: 20_000,
  socketTimeout: 60_000,
}

export function getEmailTransport(): Transporter | null {
  if (transporter) return transporter
  if (process.env.SMTP_URL) {
    transporter = nodemailer.createTransport({
      url: process.env.SMTP_URL,
      ...SMTP_TIMEOUTS,
    })
  } else if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      ...SMTP_TIMEOUTS,
    })
  }
  return transporter
}

async function captureEmail(dir: string, to: string, subject: string, text: string) {
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, `${Date.now()}-${randomBytes(4).toString('hex')}.json`),
    JSON.stringify({ to, subject, text }),
  )
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text: string
  html?: string
}) {
  // tests read what would have been sent from this folder; never set it on a deployed environment
  if (process.env.HUB_CAPTURE_EMAIL_DIR)
    await captureEmail(process.env.HUB_CAPTURE_EMAIL_DIR, to, subject, text)
  if (deliveryDisabled()) return { delivered: false }
  const t = getEmailTransport()
  if (!t) {
    console.warn('email not configured; dropping message to', to)
    // locally the message is the only way to see a confirmation link
    if (process.env.NODE_ENV !== 'production') console.info(`--- ${subject}\n${text}`)
    return { delivered: false }
  }
  await t.sendMail({
    from: process.env.EMAIL_FROM || defaultEmailFrom(),
    to,
    subject,
    text,
    html,
  })
  return { delivered: true }
}
