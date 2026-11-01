import type { Payload } from 'payload'
import { describe, it, beforeAll, expect } from 'vitest'

import { ageFromDob } from '../../src/shared/age'
import { retentionCutoff, validateGuardianEnquiry } from '../../src/shared/guardianEnquiry'
import { testPayload } from './provision'
import { api, session } from './helpers'

const NOW = new Date('2026-10-22T12:00:00Z')
const request = {
  guardianName: '  Test   Guardian ',
  guardianEmail: 'Guardian@Example.TEST',
  relationship: 'parent',
  guardianAuthority: true,
}

describe('guardian pathway rules', () => {
  it('counts a birthday on today’s UTC date as 18', () => {
    expect(ageFromDob('2008-10-22', NOW)).toBe(18)
    expect(ageFromDob('2008-10-23', NOW)).toBe(17)
  })

  it('rejects year-only and impossible dates', () => {
    expect(ageFromDob('2008', NOW)).toBeNull()
    expect(ageFromDob('2008-02-31', NOW)).toBeNull()
  })

  it('keeps only the guardian fields', () => {
    const result = validateGuardianEnquiry({
      ...request,
      dateOfBirth: '2012-01-01',
      email: 'child@example.test',
    })
    expect(Object.keys(result.data || {}).sort()).toEqual([
      'consentStatement',
      'consentedAt',
      'guardianEmail',
      'guardianName',
      'relationship',
    ])
    expect(result.data?.guardianName).toBe('Test Guardian')
    expect(result.data?.guardianEmail).toBe('guardian@example.test')
    expect(JSON.stringify(result)).not.toContain('child@example.test')
  })

  it('requires every field and a strict confirmation', () => {
    const result = validateGuardianEnquiry({ ...request, guardianAuthority: 'true' })
    expect(result.fields?.guardianAuthority).toBeTruthy()
    expect(Object.keys(validateGuardianEnquiry({}).fields || {}).sort()).toEqual([
      'guardianAuthority',
      'guardianEmail',
      'guardianName',
      'relationship',
    ])
    expect(
      validateGuardianEnquiry({ ...request, relationship: 'legal_guardian' }).data,
    ).toBeTruthy()
  })

  it('treats the honeypot as automated', () => {
    expect(validateGuardianEnquiry({ ...request, hpWebsite: 'x' })).toEqual({ honeypot: true })
  })

  it('keeps requests for twelve months', () => {
    expect(retentionCutoff(NOW).toISOString().slice(0, 7)).toBe('2025-10')
  })
})

describe('guardian pathway api', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await testPayload()
  })

  it('stores a request only the Membership Team can see and close', async () => {
    const email = `guardian-${Date.now()}@test.invalid`
    const created = await api('/auth/guardian-enquiry', {
      method: 'POST',
      body: JSON.stringify({ ...request, guardianEmail: email }),
    })
    expect(created.status).toBe(201)
    expect(created.headers.get('cache-control')).toContain('no-store')

    const member = await session({})
    const denied = await api('/member/team/membership/overview', { cookie: member.cookie })
    expect(denied.status).toBe(403)

    const team = await session({ membershipTrack: 'constituency_work', teams: ['membership_team'] })
    const overview = await (
      await api('/member/team/membership/overview', { cookie: team.cookie })
    ).json()
    const row = overview.guardianEnquiries.find(
      (g: { guardianEmail: string }) => g.guardianEmail === email,
    )
    expect(row).toBeTruthy()

    const closed = await api(`/member/team/membership/guardian-enquiries/${row.id}/close`, {
      method: 'POST',
      cookie: team.cookie,
    })
    expect(closed.status).toBe(200)
    const left = await payload.find({
      collection: 'guardian-enquiries',
      where: { guardianEmail: { equals: email } },
      overrideAccess: true,
    })
    expect(left.totalDocs).toBe(0)

    const log = await payload.find({
      collection: 'audit-log',
      where: {
        action: { equals: 'guardian_enquiry.closed' },
        targetId: { equals: String(row.id) },
      },
      overrideAccess: true,
    })
    expect(log.totalDocs).toBe(1)
    expect(JSON.stringify(log.docs[0])).not.toContain(email)

    const again = await api(`/member/team/membership/guardian-enquiries/${row.id}/close`, {
      method: 'POST',
      cookie: team.cookie,
    })
    expect(again.status).toBe(404)
  })

  it('answers the honeypot without storing anything', async () => {
    const email = `honeypot-${Date.now()}@test.invalid`
    const res = await api('/auth/guardian-enquiry', {
      method: 'POST',
      body: JSON.stringify({ ...request, guardianEmail: email, hpWebsite: 'x' }),
    })
    expect(res.status).toBe(201)
    const rows = await payload.find({
      collection: 'guardian-enquiries',
      where: { guardianEmail: { equals: email } },
      overrideAccess: true,
    })
    expect(rows.totalDocs).toBe(0)
  })

  it('rejects an incomplete request', async () => {
    const res = await api('/auth/guardian-enquiry', { method: 'POST', body: '{}' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.fields.guardianEmail).toBeTruthy()
  })
})
