/**
 * Registration validator coverage. The validator reads its option lists and
 * the privacy notice from content documents, so the spec stubs
 * `req.payload.find` — no server or database required.
 */
import type { AnyValue, Doc } from '../../src/lib/domain'
import { describe, it, expect } from 'vitest'

import { validateRegistration } from '@/lib/registration'

const NOTICE = {
  PRIVACY_VERSION: '2024-09',
  CONSENT_STATEMENT: 'I consent to the described processing.',
}

const OPTIONS = {
  regions: ['Global'],
  genders: ['Female', 'Other'],
  minorityOptions: ['None', 'Other'],
  ageBands: [{ value: 'under_18' }, { value: '18_35' }, { value: '35_plus' }],
  youthAffiliations: [{ value: 'member' }],
  nationalities: ['Testlandian'],
}

const req = {
  payload: {
    find: async ({ where }: AnyValue) => {
      const slug = where?.slug?.equals
      const docs: Doc = {
        'privacy-notice': { slug, title: 'Privacy notice', body: NOTICE },
        'registration-options': { slug, title: 'Options', body: OPTIONS },
      }
      return { docs: docs[slug] ? [docs[slug]] : [] }
    },
  },
} as AnyValue

const individual = (overrides: Record<string, unknown> = {}) => ({
  entityType: 'individual',
  membershipTrack: 'network',
  membershipPolicyVersion: '2024-09',
  password: 'a-secure-password',
  passwordConfirm: 'a-secure-password',
  email: 'new@example.org',
  firstName: 'New',
  lastName: 'Member',
  phone: '+10000000000',
  gender: 'Female',
  ageBand: '18_35',
  dateOfBirth: '2000-01-01',
  minorityIdentity: 'no',
  region: 'Global',
  nationality: 'Testlandian',
  countryOfResidence: 'Testland',
  memberOfAccreditedNgo: 'no',
  privacyConsent: true,
  privacyNoticeVersion: NOTICE.PRIVACY_VERSION,
  acceptCodeOfConduct: true,
  acceptDataProtection: true,
  acceptPrinciples: true,
  acceptCoiPolicy: true,
  ...overrides,
})

describe('validateRegistration', () => {
  it('accepts a complete individual registration', async () => {
    const res = await validateRegistration(req, individual())
    expect(res.fields).toBeUndefined()
    expect(res.data?.email).toBe('new@example.org')
    expect(res.data?.entityType).toBe('individual')
    expect(res.data?.privacyConsent).toBe(true)
    expect(res.data?.privacyNoticeVersion).toBe(NOTICE.PRIVACY_VERSION)
  })

  it('trips the honeypot', async () => {
    const res = await validateRegistration(req, individual({ hpWebsite: 'spam' }))
    expect(res.honeypot).toBe(true)
    expect(res.data).toBeUndefined()
  })

  it('falls through to individual validation when entityType is invalid', async () => {
    const res = await validateRegistration(req, individual({ entityType: 'bogus' }))
    expect(res.fields?.entityType).toBeTruthy()
    // Invalid entity does not skip the individual-field checks.
    expect(res.fields?.firstName).toBeUndefined()
    expect(res.data).toBeUndefined()
  })

  it('rejects a stale privacy notice version', async () => {
    const res = await validateRegistration(req, individual({ privacyNoticeVersion: 'outdated' }))
    expect(res.fields?.privacyConsent).toMatch(/updated/i)
  })

  it('requires guardian details for under-18 members', async () => {
    const res = await validateRegistration(
      req,
      individual({ ageBand: 'under_18', dateOfBirth: '2012-01-01' }),
    )
    expect(res.fields?.guardianName).toBeTruthy()
    expect(res.fields?.guardianEmail).toBeTruthy()
    expect(res.fields?.guardianConsent).toBeTruthy()
  })

  it('rejects members over 35', async () => {
    const res = await validateRegistration(
      req,
      individual({ ageBand: '35_plus', dateOfBirth: '1980-01-01' }),
    )
    expect(res.fields?.ageBand).toMatch(/35/)
    expect(res.fields?.dateOfBirth).toMatch(/35/)
  })

  it('rejects passwords that do not match', async () => {
    const res = await validateRegistration(req, individual({ passwordConfirm: 'different' }))
    expect(res.fields?.passwordConfirm).toBeTruthy()
  })

  it('accepts a complete UNFCCC-admitted organisation', async () => {
    const res = await validateRegistration(
      req,
      individual({
        entityType: 'organization',
        email: 'org@example.org',
        organizationName: 'Test Org',
        isUnfcccAdmitted: 'yes',
        youthAffiliation: 'member',
        region: 'Global',
        orgCountry: 'Testland',
        dcpName: 'Dcp Person',
        dcpEmail: 'dcp@example.org',
        dcpPhone: '+10000000001',
      }),
    )
    expect(res.fields).toBeUndefined()
    expect(res.data?.organizationType).toBe('unfccc_admitted')
    expect(res.data?.entityType).toBe('organization')
  })

  it('requires contact point details for non-admitted organisations', async () => {
    const res = await validateRegistration(
      req,
      individual({
        entityType: 'organization',
        email: 'org@example.org',
        organizationName: 'Test Org',
        isUnfcccAdmitted: 'no',
      }),
    )
    expect(res.fields?.orgOperateIn).toBeTruthy()
    expect(res.fields?.ycpName).toBeTruthy()
    expect(res.fields?.ycpEmail).toBeTruthy()
  })
})
