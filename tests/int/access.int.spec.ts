import { describe, it, beforeAll, expect } from 'vitest'

import { testPayload } from './provision'
import { api, session } from './helpers'

describe('generated API access control', () => {
  let member: { cookie: string; account: any }
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
      'assignments',
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
    for (const slug of ['content-announcements', 'assignments', 'content-coys']) {
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
    const res = await api('/working-groups?limit=1', { cookie: member.cookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    // The provisioned member's working group must be listed, and must not
    // carry the gated contact-channel fields.
    const doc = body.docs?.[0]
    expect(doc).toBeTruthy()
    expect(doc.whatsappUrl).toBeUndefined()
    expect(doc.groupUrl).toBeUndefined()
    expect(doc.driveUrl).toBeUndefined()
    expect(doc.taskForces).toBeUndefined()
  })

  it('grants wg.manage only for coordination assignment roles', async () => {
    const { getAccessProfile } = await import('@/lib/access')
    const payload = await testPayload()
    const account = member.account
    const assignment = await payload.create({
      collection: 'assignments',
      data: {
        account: account.id,
        scopeType: 'working_group',
        scopeId: 'contract-wg',
        role: 'member',
        status: 'active',
        startsAt: new Date(Date.now() - 86400000).toISOString(),
      } as any,
      overrideAccess: true,
    })
    try {
      const req = { payload } as any
      const memberProfile = await getAccessProfile(req, account)
      expect(memberProfile.capabilities).not.toContain('wg.manage:contract-wg')
      await payload.update({
        collection: 'assignments',
        id: assignment.id,
        data: { role: 'contact' },
        overrideAccess: true,
      })
      const contactProfile = await getAccessProfile(req, account)
      expect(contactProfile.capabilities).toContain('wg.manage:contract-wg')
    } finally {
      await payload.delete({
        collection: 'assignments',
        id: assignment.id,
        overrideAccess: true,
      })
    }
  })
})
