import nodemailer, { type Transporter } from 'nodemailer'

// Outbound email. Mirrors EMAIL_* / SMTP_* envs from the legacy service; when
// unconfigured, messages are logged and dropped (delivery-failure pattern from
// server/lib/notifications/transport.js).
export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL || (process.env.SMTP_HOST && process.env.EMAIL_FROM))
}

let transporter: Transporter | null = null

function getTransporter() {
  if (transporter) return transporter
  if (process.env.SMTP_URL) {
    transporter = nodemailer.createTransport(process.env.SMTP_URL)
  } else if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  }
  return transporter
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
  const t = getTransporter()
  if (!t) {
    console.warn('email not configured; dropping message to', to)
    return { delivered: false }
  }
  await t.sendMail({
    from: process.env.EMAIL_FROM || 'hub@youngohub.org',
    to,
    subject,
    text,
    html,
  })
  return { delivered: true }
}
