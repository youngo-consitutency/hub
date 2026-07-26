import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { publicAccount, validateRegistration } from '../server/lib/accounts.js'
import { hashPassword, verifyPassword } from '../server/lib/password.js'
import { POLICY_VERSION } from '../src/content/membershipPolicy.js'
import { PRIVACY_VERSION, CONSENT_STATEMENT } from '../shared/privacyNotice.js'

function individual(overrides = {}) {
  return {
    firstName: 'Ada',
    lastName: 'Youth',
    email: 'ada@example.org',
    password: 'secure-pass-1',
    passwordConfirm: 'secure-pass-1',
    entityType: 'individual',
    membershipTrack: 'network',
    ageBand: '18_35',
    phone: '+254 700 000 000',
    gender: 'Female',
    dateOfBirth: '2000-06-15',
    minorityIdentity: 'no',
    minorityGroups: [],
    region: 'Africa',
    nationality: 'Kenyan',
    countryOfResidence: 'Kenya',
    motivation: 'To advance climate justice.',
    acceptCodeOfConduct: true,
    acceptDataProtection: true,
    acceptPrinciples: true,
    acceptCoiPolicy: true,
    memberOfAccreditedNgo: false,
    membershipPolicyVersion: POLICY_VERSION,
    privacyConsent: true,
    privacyNoticeVersion: PRIVACY_VERSION,
    ...overrides,
  }
}

function admittedOrg(overrides = {}) {
  return {
    email: 'org@example.org',
    password: 'secure-pass-1',
    passwordConfirm: 'secure-pass-1',
    entityType: 'organization',
    organizationName: 'Youth Climate Alliance',
    isUnfcccAdmitted: true,
    youthAffiliation: 'primary',
    region: 'Western Europe and Others',
    orgCountry: 'Germany',
    orgOperateIn: 'Europe and West Africa',
    orgWebsite: 'https://example.org',
    orgMission: 'Empower youth in climate negotiations.',
    dcpName: 'Dana Contact',
    dcpEmail: 'dcp@example.org',
    dcpPhone: '+49 30 123456',
    acceptAllOrgPolicies: true,
    membershipPolicyVersion: POLICY_VERSION,
    privacyConsent: true,
    privacyNoticeVersion: PRIVACY_VERSION,
    ...overrides,
  }
}

function nonAdmittedOrg(overrides = {}) {
  return {
    email: 'movement@example.org',
    password: 'secure-pass-1',
    passwordConfirm: 'secure-pass-1',
    entityType: 'organization',
    organizationName: 'Local Youth Network',
    isUnfcccAdmitted: false,
    orgOperateIn: 'Chile and Argentina',
    orgWebsite: 'https://example.org',
    orgMission: 'Community climate education.',
    ycpName: 'Sam Facilitator',
    ycpEmail: 'sam@example.org',
    ycpPhone: '+56 9 1111 2222',
    acceptAllOrgPolicies: true,
    membershipPolicyVersion: POLICY_VERSION,
    privacyConsent: true,
    privacyNoticeVersion: PRIVACY_VERSION,
    ...overrides,
  }
}

describe('password hashing', () => {
  it('verifies a matching password', async () => {
    const { salt, hash } = await hashPassword('hello-world-99')
    assert.equal(await verifyPassword('hello-world-99', salt, hash), true)
  })
})

describe('hub access status', () => {
  it('does not treat a suspended verified member as verified', () => {
    const account = publicAccount({
      id: 'suspended-member',
      email: 'suspended@example.org',
      member_status: 'verified',
      hub_access_status: 'suspended',
      role: 'member',
    })
    assert.equal(account.isVerified, false)
  })

  it('does not let a suspended platform role bypass the access status', () => {
    const account = publicAccount({
      id: 'suspended-admin',
      email: 'admin@example.org',
      member_status: 'verified',
      hub_access_status: 'suspended',
      role: 'admin',
    })
    assert.equal(account.isVerified, false)
  })
})

describe('privacy consent', () => {
  it('refuses an individual who has not consented', () => {
    const result = validateRegistration(individual({ privacyConsent: false }))
    assert.equal(result.data, undefined)
    assert.ok(result.fields.privacyConsent)
  })

  it('refuses an organisation who has not consented', () => {
    const result = validateRegistration(admittedOrg({ privacyConsent: false }))
    assert.equal(result.data, undefined)
    assert.ok(result.fields.privacyConsent)
  })

  it('is not satisfied by the separate data protection policy agreement', () => {
    const result = validateRegistration(
      individual({
        privacyConsent: false,
        acceptDataProtection: true,
      }),
    )
    assert.equal(result.data, undefined)
    assert.ok(result.fields.privacyConsent)
  })

  it('records the notice version, statement, and timestamp', () => {
    const result = validateRegistration(individual())
    assert.ok(result.data, JSON.stringify(result.fields))
    assert.equal(result.data.privacyConsent, true)
    assert.equal(result.data.privacyNoticeVersion, PRIVACY_VERSION)
    assert.equal(result.data.privacyConsentStatement, CONSENT_STATEMENT)
    assert.ok(Number.isFinite(Date.parse(result.data.privacyConsentAt)))
  })

  it('rejects consent claimed against a stale notice version', () => {
    const result = validateRegistration(
      individual({ privacyNoticeVersion: 'v0-2020-01-01' }),
    )
    assert.equal(result.data, undefined)
    assert.ok(result.fields.privacyConsent)
  })

  it('records the server version when the client sends none', () => {
    const result = validateRegistration(
      individual({ privacyNoticeVersion: undefined }),
    )
    assert.ok(result.data, JSON.stringify(result.fields))
    assert.equal(result.data.privacyNoticeVersion, PRIVACY_VERSION)
  })
})

describe('individual nationality', () => {
  it('accepts a nationality from the published list', () => {
    const result = validateRegistration(individual({ nationality: 'Kenyan' }))
    assert.ok(result.data, JSON.stringify(result.fields))
  })

  it('rejects free text outside the published list', () => {
    const result = validateRegistration(
      individual({ nationality: 'Somewhere-ish' }),
    )
    assert.equal(
      result.fields.nationality,
      'Please select a nationality from the list.',
    )
  })
})

describe('individual registration', () => {
  it('accepts a valid individual', () => {
    const result = validateRegistration(individual())
    assert.ok(result.data, JSON.stringify(result.fields))
    assert.equal(result.data.entityType, 'individual')
  })

  it('rejects 35+', () => {
    const result = validateRegistration(individual({ ageBand: '35_plus' }))
    assert.ok(result.fields.ageBand)
  })

  it('requires the minority yes-or-no answer', () => {
    const result = validateRegistration(individual({ minorityIdentity: '' }))
    assert.ok(result.fields.minorityIdentity)
  })

  it('requires a selection after a minority yes answer', () => {
    const result = validateRegistration(
      individual({ minorityIdentity: 'yes', minorityGroups: [] }),
    )
    assert.ok(result.fields.minorityGroups)
  })

  it('stores selected minority groups only after a yes answer', () => {
    const yes = validateRegistration(
      individual({
        minorityIdentity: 'yes',
        minorityGroups: ['Indigenous peoples', 'Women'],
      }),
    )
    assert.deepEqual(yes.data.minorityGroups, ['Indigenous peoples', 'Women'])

    const no = validateRegistration(
      individual({
        minorityIdentity: 'no',
        minorityGroups: ['Women'],
      }),
    )
    assert.deepEqual(no.data.minorityGroups, [])
  })
})

describe('admitted organisation registration', () => {
  it('accepts admitted NGO with DCP', () => {
    const result = validateRegistration(admittedOrg())
    assert.ok(result.data, JSON.stringify(result.fields))
    assert.equal(result.data.isUnfcccAdmitted, true)
    assert.equal(result.data.organizationType, 'unfccc_admitted')
    assert.equal(result.data.dcpEmail, 'dcp@example.org')
    assert.equal(result.data.youthAffiliation, 'primary')
    assert.equal(
      result.data.role,
      'member',
      'self-attestation must not grant NGO authority',
    )
  })

  it('requires youth affiliation and DCP fields', () => {
    const result = validateRegistration(
      admittedOrg({
        youthAffiliation: '',
        dcpName: '',
        dcpEmail: '',
        dcpPhone: '',
      }),
    )
    assert.ok(result.fields.youthAffiliation)
    assert.ok(result.fields.dcpName)
    assert.ok(result.fields.dcpEmail)
    assert.ok(result.fields.dcpPhone)
  })

  it('requires full YOUNGO CP when partially filled', () => {
    const result = validateRegistration(admittedOrg({ ycpName: 'Only Name' }))
    assert.ok(result.fields.ycpEmail)
    assert.ok(result.fields.ycpPhone)
  })
})

describe('non-admitted organisation registration', () => {
  it('accepts non-admitted with required CP', () => {
    const result = validateRegistration(nonAdmittedOrg())
    assert.ok(result.data, JSON.stringify(result.fields))
    assert.equal(result.data.isUnfcccAdmitted, false)
    assert.equal(result.data.organizationType, 'non_admitted')
    assert.equal(result.data.ycpName, 'Sam Facilitator')
  })

  it('requires operation regions and YOUNGO CP', () => {
    const result = validateRegistration(
      nonAdmittedOrg({
        orgOperateIn: '',
        ycpName: '',
        ycpEmail: '',
        ycpPhone: '',
      }),
    )
    assert.ok(result.fields.orgOperateIn)
    assert.ok(result.fields.ycpName)
    assert.ok(result.fields.ycpEmail)
    assert.ok(result.fields.ycpPhone)
  })

  it('requires admitted yes/no', () => {
    const result = validateRegistration(
      nonAdmittedOrg({ isUnfcccAdmitted: null }),
    )
    assert.ok(result.fields.isUnfcccAdmitted)
  })
})
