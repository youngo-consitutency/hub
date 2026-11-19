import type { ErrorEvent } from '@sentry/nextjs'
import { describe, expect, it } from 'vitest'

import { scrubSentryEvent } from '../../src/lib/sentry'

const scrub = (event: Partial<ErrorEvent>) => scrubSentryEvent(event as ErrorEvent)

describe('scrubSentryEvent', () => {
  it('hides invite and unsubscribe tokens in the request URL', () => {
    const event = scrub({
      request: { url: 'https://hub.example/api/member/ngo/invite/abc123secret?ref=mail' },
    })
    expect(event.request?.url).toBe('https://hub.example/api/member/ngo/invite/[Filtered]?ref=mail')
  })

  it('hides sensitive query parameters and keeps harmless ones', () => {
    const event = scrub({ request: { url: 'https://hub.example/x?token=s3cret&page=2' } })
    expect(event.request?.url).toBe('https://hub.example/x?token=[Filtered]&page=2')
  })

  it('removes email addresses and Postgres key values from error messages', () => {
    const event = scrub({
      exception: {
        values: [
          {
            value:
              'duplicate key: Key (email)=(someone@example.org) already exists; mailed other@example.org',
          },
        ],
      },
    })
    const message = event.exception?.values?.[0]?.value ?? ''
    expect(message).not.toContain('someone@example.org')
    expect(message).not.toContain('other@example.org')
  })

  it('scrubs guardian and date-of-birth fields in request bodies', () => {
    const event = scrub({
      request: { data: { guardianEmail: 'p@example.org', dateOfBirth: '2010-01-01', ok: 'keep' } },
    })
    expect(event.request?.data).toEqual({
      guardianEmail: '[Filtered]',
      dateOfBirth: '[Filtered]',
      ok: 'keep',
    })
  })

  it('survives a malformed percent sequence in a query key', () => {
    expect(() => scrub({ request: { query_string: '%E0%A4%A=1&page=2' } })).not.toThrow()
  })
})
