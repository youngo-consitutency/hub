import type { AnyValue } from '../../src/lib/domain'
import { describe, it, beforeAll, expect } from 'vitest'

import { provisionAccount, testPayload } from './provision'
import { api, session } from './helpers'

describe('generated API access control', () => {
  let member: { cookie: string; account: AnyValue }
  let memberAccountId: string

  beforeAll(async () => {
    member = await session({})
    memberAccountId = String(member.account.id)
    expect(memberAccountId).toBeTruthy()
  })

  it('rejects anonymous writes to every content collection', async () => {
    for (const slug of [
      'content-announcements',
      'content-events',
      'catalogue-resources',
      'content-coys',
      'opportunities',
      'working-groups',
      'authority-records',
      'feedback-tickets',
    ]) {
      const res = await api(`/${slug}`, {
        method: 'POST',
        body: JSON.stringify({ title: 'x', name: 'x' }),
      })
      expect([401, 403]).toContain(res.status)
    }
  })

  it('rejects member writes to staff-managed collections', async () => {
    for (const slug of ['content-announcements', 'authority-records', 'content-coys']) {
      const res = await api(`/${slug}`, {
        method: 'POST',
        cookie: member.cookie,
        body: JSON.stringify({ title: 'x', name: 'x' }),
      })
      expect(res.status).toBe(403)
    }
  })

  it('lets a member file only their own feedback ticket', async () => {
    const res = await api('/feedback-tickets', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        title: 'contract ticket',
        kind: 'other',
        body: 'access contract test',
      }),
    })
    expect([200, 201]).toContain(res.status)
    const forged = await api('/feedback-tickets', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        title: 'forged',
        kind: 'other',
        body: 'x',
        account: '1',
      }),
    })
    expect(forged.status).toBe(403)
  })

  it('prevents members patching privileged account fields via REST', async () => {
    const res = await api(`/accounts/${memberAccountId}`, {
      method: 'PATCH',
      cookie: member.cookie,
      body: JSON.stringify({ role: 'admin', teamRoles: ['membership_team'] }),
    })
    expect(res.status).toBe(403)
    const me = await api(`/accounts/${memberAccountId}`, {
      cookie: member.cookie,
    })
    const doc = await me.json()
    expect(doc.role).not.toBe('admin')
  })

  it('hides gated working-group channels from members via REST', async () => {
    // Members can read working groups over REST; the gated contact-channel
    // fields are staff-only. Provision the group with those fields set so
    // the assertion runs on real data.
    const payload = await testPayload()
    const slug = `gated-${Math.random().toString(36).slice(2, 8)}`
    await payload.create({
      collection: 'working-groups',
      data: {
        slug,
        name: 'Gated channels fixture',
        whatsappUrl: 'https://chat.example/fixture',
        groupUrl: 'https://group.example/fixture',
        driveUrl: 'https://drive.example/fixture',
      } as AnyValue,
      overrideAccess: true,
    })
    const res = await api('/working-groups?limit=50', { cookie: member.cookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    const doc = body.docs?.find((d: AnyValue) => d.slug === slug)
    expect(doc).toBeTruthy()
    expect(doc.whatsappUrl).toBeUndefined()
    expect(doc.groupUrl).toBeUndefined()
    expect(doc.driveUrl).toBeUndefined()
    expect(doc.taskForces).toBeUndefined()
  })

  it('grants wg.manage only for coordination authority records', async () => {
    const { getAccessProfile } = await import('@/lib/access')
    const payload = await testPayload()
    // WG Contact Point is a CW-gated mandate (S17/S25) — the holder needs
    // active Constituency Work membership.
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const record = await payload.create({
      collection: 'authority-records',
      data: {
        account: account.id,
        kind: 'participation',
        scopeType: 'working_group',
        scopeId: 'contract-wg',
        role: 'wg.member',
        status: 'active',
        startsAt: new Date(Date.now() - 86400000).toISOString(),
      } as AnyValue,
      overrideAccess: true,
    })
    try {
      const req = { payload } as AnyValue
      const memberProfile = await getAccessProfile(req, account)
      expect(memberProfile.capabilities).not.toContain('wg.manage:contract-wg')
      await payload.update({
        collection: 'authority-records',
        id: record.id,
        data: { role: 'wg.contact_point' },
        overrideAccess: true,
      })
      const contactProfile = await getAccessProfile(req, account)
      expect(contactProfile.capabilities).toContain('wg.manage:contract-wg')
    } finally {
      await payload.delete({
        collection: 'authority-records',
        id: record.id,
        overrideAccess: true,
      })
    }
  })
})
