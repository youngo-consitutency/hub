import { appOrigin } from './config.js'
import {
  deliveryFailure,
  emailConfigured,
  sendTemplatedEmail,
} from './notifications/transport.js'

export async function sendMembershipActivatedEmail(account, env = process.env) {
  if (!account?.email) return { sent: false, reason: 'missing_recipient' }
  if (!emailConfigured(env)) return { sent: false, reason: 'not_configured' }
  const firstName =
    String(account.firstName || account.name || '')
      .trim()
      .split(/\s+/)[0] || 'there'
  try {
    await sendTemplatedEmail({
      to: account.email,
      templateKey: 'membership-activated',
      data: {
        firstName,
        actionUrl: `${appOrigin(env)}/`,
        actionLabel: 'Open YOUNGO Hub',
      },
      env,
    })
    return { sent: true }
  } catch (error) {
    const failure = deliveryFailure(error)
    console.warn(
      JSON.stringify({
        event: 'membership_activated_email_failed',
        accountId: account.id,
        code: failure.code,
      }),
    )
    return { sent: false, reason: failure.code }
  }
}
