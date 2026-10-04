import { describe, expect, it, vi, afterEach } from 'vitest'
import type { PayloadRequest } from 'payload'
import { publicEndpoints } from '../../src/endpoints/public'
import { emailConfigured, sendEmail } from '../../src/lib/email'
import { deliverPush } from '../../src/lib/push'

const handler = publicEndpoints.find((item) => item.path === '/landing')!.handler

afterEach(() => vi.unstubAllEnvs())

describe('Public landing feed', () => {
  it('bounds the query and returns only public event fields', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [
        {
          id: 5,
          slug: 'sample',
          title: 'An event',
          startsAt: '2027-01-01T12:00:00Z',
          meetingUrl: 'https://private.example.invalid',
          description: 'Internal note',
        },
      ],
    })
    const req = { payload: { find } } as unknown as PayloadRequest
    const response = await handler(req)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      events: [
        {
          slug: 'sample',
          title: 'An event',
          startsAt: '2027-01-01T12:00:00Z',
        },
      ],
    })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'content-events',
        limit: 3,
        depth: 0,
        sort: 'startsAt',
        overrideAccess: false,
        req,
        select: { slug: true, title: true, startsAt: true },
        where: {
          and: [
            { state: { equals: 'published' } },
            { startsAt: { greater_than_equal: expect.any(String) } },
          ],
        },
      }),
    )
  })

  it('represents an empty database honestly', async () => {
    const req = {
      payload: { find: vi.fn().mockResolvedValue({ docs: [] }) },
    } as unknown as PayloadRequest
    expect(await (await handler(req)).json()).toEqual({ events: [] })
  })
})

describe('Demo delivery guard', () => {
  it('does not attempt email delivery even with SMTP configured', async () => {
    vi.stubEnv('HUB_DEMO_MODE', 'true')
    vi.stubEnv('SMTP_URL', 'smtp://127.0.0.1:1')
    expect(emailConfigured()).toBe(false)
    expect(await sendEmail({ to: 'demo@example.invalid', subject: 'Demo', text: 'Demo' })).toEqual({
      delivered: false,
    })
  })

  it('does not contact push endpoints', async () => {
    vi.stubEnv('HUB_DEMO_MODE', 'true')
    expect(await deliverPush([{ endpoint: 'https://invalid.example.invalid' }], '{}')).toEqual({
      sent: 0,
      failed: 0,
      pruned: 0,
      total: 1,
    })
  })
})

describe('Group management presentation', () => {
  it('does not show contact tools to ordinary group members', async () => {
    const { canManageGroups, canManageGroup } = await import('../../src/member/lib/groupPermissions')
    const member = {
      access: { wgAssignments: [{ wgSlug: 'finance', role: 'member' }], capabilities: [] },
    }
    expect(canManageGroups(member)).toBe(false)
    expect(canManageGroup(member, 'finance')).toBe(false)
    const contact = { access: { capabilities: ['wg.manage:finance'] } }
    expect(canManageGroups(contact)).toBe(true)
    expect(canManageGroup(contact, 'finance')).toBe(true)
    expect(canManageGroup(contact, 'oceans')).toBe(false)
  })
})

describe('Dashboard counts', () => {
  it('counts upcoming events before limiting the preview cards', async () => {
    const { assembleFeed } = await import('../../src/lib/feed')
    const now = new Date('2027-01-01T12:00:00Z')
    const events = Array.from({ length: 8 }, (_, i) => ({
      slug: String(i),
      startsAt: new Date(now.getTime() + (i + 1) * 3600000).toISOString(),
    }))
    const feed = assembleFeed({ events }, now)
    expect(feed.week).toHaveLength(5)
    expect(feed.counts.week).toBe(8)
  })
})
