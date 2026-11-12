import type { CollectionConfig } from 'payload'
import { noAccess, noFieldAccess } from '../lib/collectionAccess'

// Member accounts — replaces hub_accounts + hub_sessions + password/verify
// token tables. Payload auth provides password hashing and httpOnly cookie
// sessions behind /api/auth/*; the fields below carry YOUNGO's registration and
// lifecycle model.
export const Accounts: CollectionConfig = {
  slug: 'accounts',
  auth: {
    useAPIKey: false,
    tokenExpiration: 60 * 60 * 24 * 30,
    verify: false,
    maxLoginAttempts: 10,
    lockTime: 15 * 60 * 1000,
    cookies: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      domain: undefined,
    },
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (operation === 'update' && data?.password)
          data.credentialEpoch = (originalDoc?.credentialEpoch || 1) + 1
        return data
      },
    ],
  },
  // no generated rest here: payload's login/forgot/reset/first-register/unlock
  // skip our rate limits and reset flow. /api/auth/* is the only way in;
  // payload.login and cookie sessions still work without these
  endpoints: false,
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      return { id: { equals: req.user.id } }
    },
    unlock: noAccess,
    // Member writes go through domain endpoints (registration, profile,
    // lifecycle review) which authorise the actor and use overrideAccess.
    create: noAccess,
    update: noAccess,
    delete: noAccess,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'firstName', type: 'text' },
    { name: 'lastName', type: 'text' },
    { name: 'phone', type: 'text' },
    { name: 'gender', type: 'text' },
    { name: 'genderOther', type: 'text' },
    { name: 'ageBand', type: 'text' },
    { name: 'dateOfBirth', type: 'date' },
    { name: 'minorityGroups', type: 'json' },
    { name: 'minorityOther', type: 'text' },
    { name: 'region', type: 'text' },
    { name: 'nationality', type: 'text' },
    { name: 'country', type: 'text', required: true },
    { name: 'motivation', type: 'textarea' },
    {
      name: 'entityType',
      type: 'select',
      required: true,
      options: [
        { label: 'Individual', value: 'individual' },
        { label: 'Organisation', value: 'organization' },
      ],
      defaultValue: 'individual',
    },
    {
      name: 'postingTrust',
      access: { update: noFieldAccess },
      type: 'select',
      options: [
        { label: 'Trusted — postings go live immediately', value: 'trusted' },
        { label: 'Review required', value: 'review_required' },
      ],
    },
    {
      name: 'postingTrustNote',
      access: { update: noFieldAccess },
      type: 'textarea',
    },
    {
      name: 'membershipTrack',
      access: { update: noFieldAccess },
      type: 'select',
      required: true,
      options: [
        { label: 'YOUNGO Network', value: 'network' },
        { label: 'Constituency Work', value: 'constituency_work' },
      ],
      defaultValue: 'network',
    },
    { name: 'organizationName', type: 'text', label: 'Organisation name' },
    { name: 'organizationType', type: 'text', label: 'Organisation type' },
    { name: 'isUnfcccAdmitted', type: 'checkbox', defaultValue: false },
    { name: 'orgOperateIn', type: 'text' },
    { name: 'orgWebsite', type: 'text' },
    { name: 'orgSocial', type: 'text' },
    { name: 'orgMission', type: 'textarea' },
    { name: 'dcpName', type: 'text', label: 'Designated contact point' },
    { name: 'dcpEmail', type: 'text' },
    { name: 'dcpPhone', type: 'text' },
    { name: 'ycpName', type: 'text', label: 'Youth contact point' },
    { name: 'ycpEmail', type: 'text' },
    { name: 'ycpPhone', type: 'text' },
    { name: 'under18', type: 'checkbox', defaultValue: false },
    { name: 'guardianName', type: 'text' },
    { name: 'guardianEmail', type: 'text' },
    {
      name: 'guardianConsent',
      access: { update: noFieldAccess },
      type: 'checkbox',
      defaultValue: false,
    },
    { name: 'memberOfAccreditedNgo', type: 'checkbox', defaultValue: false },
    { name: 'coiDeclared', type: 'checkbox', defaultValue: false },
    { name: 'coiDetails', type: 'textarea' },
    { name: 'youthAffiliation', type: 'text' },
    { name: 'acceptCodeOfConduct', type: 'checkbox', defaultValue: false },
    { name: 'acceptDataProtection', type: 'checkbox', defaultValue: false },
    { name: 'acceptPrinciples', type: 'checkbox', defaultValue: false },
    { name: 'acceptCoiPolicy', type: 'checkbox', defaultValue: false },
    {
      name: 'policiesAccepted',
      access: { update: noFieldAccess },
      type: 'checkbox',
      defaultValue: false,
    },
    { name: 'membershipPolicyVersion', access: { update: noFieldAccess }, type: 'text' },
    {
      name: 'privacyConsent',
      access: { update: noFieldAccess },
      type: 'checkbox',
      defaultValue: false,
    },
    { name: 'privacyConsentAt', access: { update: noFieldAccess }, type: 'date' },
    { name: 'privacyNoticeVersion', access: { update: noFieldAccess }, type: 'text' },
    { name: 'privacyConsentWithdrawnAt', access: { update: noFieldAccess }, type: 'date' },
    {
      name: 'memberStatus',
      access: { update: noFieldAccess },
      type: 'select',
      defaultValue: 'pending_course',
      options: ['pending_course', 'verified', 'suspended'],
    },
    {
      name: 'hubAccessStatus',
      access: { update: noFieldAccess },
      type: 'select',
      defaultValue: 'pending_course',
      options: ['pending_course', 'active', 'suspended'],
    },
    {
      name: 'membershipStatus',
      access: { update: noFieldAccess },
      type: 'select',
      defaultValue: 'registered',
      options: [
        'registered',
        'course_passed',
        'awaiting_onboarding',
        'active',
        'renewal_due',
        'expired',
        'terminated',
        'rejected',
      ],
      index: true,
    },
    {
      name: 'constituencyWorkStatus',
      access: { update: noFieldAccess },
      type: 'select',
      options: [
        { label: '—', value: '' },
        { label: 'Pending onboarding', value: 'pending_onboarding' },
        { label: 'Active', value: 'active' },
      ],
    },
    { name: 'onboardingCohort', access: { update: noFieldAccess }, type: 'text' },
    { name: 'renewalDueAt', access: { update: noFieldAccess }, type: 'date' },
    { name: 'membershipEndedAt', access: { update: noFieldAccess }, type: 'date' },
    { name: 'membershipEndReason', access: { update: noFieldAccess }, type: 'text' },
    {
      // Technical account kind only — authority lives in authority_records.
      name: 'role',
      access: { update: noFieldAccess },
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [{ label: 'Member', value: 'member' }],
    },
    { name: 'wgInterests', type: 'json' },
    { name: 'appointmentEvidence', access: { update: noFieldAccess }, type: 'json' },
    { name: 'coursePassedAt', access: { update: noFieldAccess }, type: 'date' },
    { name: 'courseScore', access: { update: noFieldAccess }, type: 'number' },
    { name: 'verifiedAt', access: { update: noFieldAccess }, type: 'date' },
    // Legacy stores the reviewer email, not a FK.
    { name: 'verifiedBy', access: { update: noFieldAccess }, type: 'text' },
    { name: 'emailVerifiedAt', access: { update: noFieldAccess }, type: 'date' },
    {
      name: 'principalType',
      access: { update: noFieldAccess },
      type: 'select',
      defaultValue: 'human',
      options: ['human', 'service'],
    },
    {
      name: 'mustChangePassword',
      access: { update: noFieldAccess },
      type: 'checkbox',
      defaultValue: false,
    },
    // Bumped on every password change; agent keys minted under an older
    // epoch stop working (src/lib/agentKeys.ts).
    {
      name: 'credentialEpoch',
      access: { read: noFieldAccess, update: noFieldAccess },
      type: 'number',
      defaultValue: 1,
    },
    // Legacy credential support: on first login the legacy scrypt hash is
    // verified, the Payload password is set, and these are cleared.
    { name: 'legacyPasswordHash', access: { update: noFieldAccess }, type: 'text' },
    { name: 'legacyPasswordSalt', access: { update: noFieldAccess }, type: 'text' },
    { name: 'lastLoginAt', access: { update: noFieldAccess }, type: 'date' },
    { name: 'legacyId', access: { update: noFieldAccess }, type: 'text', index: true },
  ],
}
