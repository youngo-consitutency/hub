import net from 'node:net'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { testPayload } from './provision'
import { provisionAccount } from './provision'

// a loopback SMTP sink: the outbox worker sends through the real nodemailer transport and the
// message lands here, so delivery is proved without leaving the machine
function smtpSink() {
  const messages: string[] = []
  const server = net.createServer((socket) => {
    let data = ''
    let inData = false
    const reply = (line: string) => socket.write(`${line}\r\n`)
    reply('220 sink ready')
    socket.on('data', (chunk) => {
      const text = chunk.toString()
      if (inData) {
        data += text
        if (data.endsWith('\r\n.\r\n')) {
          messages.push(data)
          data = ''
          inData = false
          reply('250 queued')
        }
        return
      }
      for (const line of text.split('\r\n').filter(Boolean)) {
        const command = line.slice(0, 4).toUpperCase()
        if (command === 'EHLO' || command === 'HELO') reply('250 sink')
        else if (command === 'DATA') {
          inData = true
          reply('354 go ahead')
        } else if (command === 'QUIT') {
          reply('221 bye')
          socket.end()
        } else reply('250 ok')
      }
    })
  })
  return { server, messages }
}

// the wire form is quoted-printable: undo soft line breaks and =XX escapes before reading it
const decoded = (raw: string) =>
  raw
    .replace(/=\r\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))

describe('mail delivery', () => {
  const sink = smtpSink()
  const tag = `mail-${Math.random().toString(36).slice(2, 8)}`

  beforeAll(async () => {
    await new Promise<void>((resolve) => sink.server.listen(0, '127.0.0.1', resolve))
    const { port } = sink.server.address() as AddressInfo
    vi.stubEnv('SMTP_HOST', '127.0.0.1')
    vi.stubEnv('SMTP_PORT', String(port))
    vi.stubEnv('SMTP_SECURE', 'false')
    vi.stubEnv('EMAIL_FROM', 'hub@test.invalid')
    vi.stubEnv('EMAIL_UNSUBSCRIBE_SECRET', 'test-secret')
    vi.stubEnv('HUB_DELIVERY_DISABLED', 'false')
    vi.stubEnv('VERCEL_ENV', '')
    vi.resetModules()
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await new Promise((resolve) => sink.server.close(resolve))
  })

  it('sends a queued notification through SMTP with its unsubscribe link', async () => {
    const payload = await testPayload()
    const { account, email } = await provisionAccount({})
    const { enqueueNotification, drainNotificationOutbox } =
      await import('../../src/lib/notifications')
    await enqueueNotification({
      accountId: account.id,
      category: 'announcement',
      templateKey: 'verify-email',
      deduplicationKey: `${tag}-1`,
      payload: { actionUrl: 'https://hub.test.invalid/verify?token=abc' },
    })
    const result = await drainNotificationOutbox({ payload } as never, { limit: 200 })
    expect(result.sent).toBeGreaterThanOrEqual(1)
    const mail = sink.messages.map(decoded).find((m) => m.includes(email))
    expect(mail, 'the sink received a message for the account').toBeTruthy()
    expect(mail).toContain('Subject: Verify your email for YOUNGO Hub updates')
    expect(mail).toContain('https://hub.test.invalid/verify?token=abc')
    expect(mail).toMatch(/unsubscribe/i)
  })
})
