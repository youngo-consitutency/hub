import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateRegistration } from '../server/lib/accounts.js'
import { hashPassword, verifyPassword } from '../server/lib/password.js'
import { POLICY_VERSION } from '../src/content/membershipPolicy.js'

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
    ...overrides,
  }
}

describe('password hashing', () => {
  it('verifies a matching password', () => {
    const { salt, hash } = hashPassword('hello-world-99')
    assert.equal(verifyPassword('hello-world-99', salt, hash), true)
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
})

describe('admitted organisation registration', () => {
  it('accepts admitted NGO with DCP', () => {
    const result = validateRegistration(admittedOrg())
    assert.ok(result.data, JSON.stringify(result.fields))
    assert.equal(result.data.isUnfcccAdmitted, true)
    assert.equal(result.data.organizationType, 'unfccc_admitted')
    assert.equal(result.data.dcpEmail, 'dcp@example.org')
    assert.equal(result.data.youthAffiliation, 'primary')
  })

  it('requires youth affiliation and DCP fields', () => {
    const result = validateRegistration(admittedOrg({
      youthAffiliation: '',
      dcpName: '',
      dcpEmail: '',
      dcpPhone: '',
    }))
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
    const result = validateRegistration(nonAdmittedOrg({
      orgOperateIn: '',
      ycpName: '',
      ycpEmail: '',
      ycpPhone: '',
    }))
    assert.ok(result.fields.orgOperateIn)
    assert.ok(result.fields.ycpName)
    assert.ok(result.fields.ycpEmail)
    assert.ok(result.fields.ycpPhone)
  })

  it('requires admitted yes/no', () => {
    const result = validateRegistration(nonAdmittedOrg({ isUnfcccAdmitted: null }))
    assert.ok(result.fields.isUnfcccAdmitted)
  })
})
