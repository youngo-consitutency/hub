import type { CollectionConfig } from 'payload'

// Member accounts — replaces hub_accounts + hub_sessions + password/verify
// token tables. Payload auth provides login/logout/me/forgot/reset and
// httpOnly cookie sessions; the fields below carry YOUNGO's registration and
// lifecycle model (see docs/existing-system.md and docs/migration.md).
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
  admin: {
    useAsTitle: 'email',
    group: 'Membership',
    defaultColumns: ['email', 'name', 'memberStatus', 'role', 'membershipTrack'],
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.collection === 'users') return true
      return { id: { equals: req.user.id } }
    },
    admin: () => false, // members never enter the console
    unlock: ({ req }) => req.user?.collection === 'users',
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
      type: 'select',
      options: [
        { label: 'Trusted — postings go live immediately', value: 'trusted' },
        { label: 'Review required', value: 'review_required' },
      ],
      admin: {
        description:
          'Organisation posting trust override; empty derives trust from a published posting.',
        condition: (data: any) => data?.entityType === 'organization',
      },
    },
    {
      name: 'membershipTrack',
      type: 'select',
      required: true,
      options: [
        { label: 'YOUNGO Network', value: 'network' },
        { label: 'Constituency Work', value: 'constituency_work' },
      ],
      defaultValue: 'network',
    },
    { name: 'organizationName', type: 'text' },
    { name: 'organizationType', type: 'text' },
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
    { name: 'guardianConsent', type: 'checkbox', defaultValue: false },
    { name: 'memberOfAccreditedNgo', type: 'checkbox', defaultValue: false },
    { name: 'coiDeclared', type: 'checkbox', defaultValue: false },
    { name: 'coiDetails', type: 'textarea' },
    { name: 'youthAffiliation', type: 'text' },
    { name: 'acceptCodeOfConduct', type: 'checkbox', defaultValue: false },
    { name: 'acceptDataProtection', type: 'checkbox', defaultValue: false },
    { name: 'acceptPrinciples', type: 'checkbox', defaultValue: false },
    { name: 'acceptCoiPolicy', type: 'checkbox', defaultValue: false },
    { name: 'policiesAccepted', type: 'checkbox', defaultValue: false },
    { name: 'membershipPolicyVersion', type: 'text' },
    { name: 'privacyConsent', type: 'checkbox', defaultValue: false },
    { name: 'privacyConsentAt', type: 'date' },
    { name: 'privacyNoticeVersion', type: 'text' },
    { name: 'privacyConsentWithdrawnAt', type: 'date' },
    {
      name: 'memberStatus',
      type: 'select',
      defaultValue: 'pending_course',
      options: ['pending_course', 'verified', 'suspended'],
    },
    {
      name: 'hubAccessStatus',
      type: 'select',
      defaultValue: 'pending_course',
      options: ['pending_course', 'active', 'suspended'],
    },
    {
      name: 'membershipStatus',
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
      type: 'select',
      options: [
        { label: '—', value: '' },
        { label: 'Pending onboarding', value: 'pending_onboarding' },
        { label: 'Active', value: 'active' },
      ],
    },
    { name: 'onboardingCohort', type: 'text' },
    { name: 'renewalDueAt', type: 'date' },
    { name: 'membershipEndedAt', type: 'date' },
    { name: 'membershipEndReason', type: 'text' },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'Member', value: 'member' },
        { label: 'Administrator', value: 'admin' },
        { label: 'Focal Point', value: 'focal_point' },
        { label: 'WG Contact Point', value: 'wg_contact' },
        { label: 'Organisation admin', value: 'ngo_admin' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'teamRoles', type: 'json' },
    { name: 'wgInterests', type: 'json' },
    { name: 'appointmentEvidence', type: 'json' },
    { name: 'coursePassedAt', type: 'date' },
    { name: 'courseScore', type: 'number' },
    { name: 'verifiedAt', type: 'date' },
    // Legacy stores the reviewer email, not a FK.
    { name: 'verifiedBy', type: 'text' },
    { name: 'emailVerifiedAt', type: 'date' },
    {
      name: 'principalType',
      type: 'select',
      defaultValue: 'human',
      options: ['human', 'service'],
    },
    { name: 'mustChangePassword', type: 'checkbox', defaultValue: false },
    // Legacy credential support: on first login the legacy scrypt hash is
    // verified, the Payload password is set, and these are cleared.
    { name: 'legacyPasswordHash', type: 'text', admin: { readOnly: true } },
    { name: 'legacyPasswordSalt', type: 'text', admin: { readOnly: true } },
    { name: 'lastLoginAt', type: 'date', admin: { readOnly: true } },
    { name: 'legacyId', type: 'text', index: true, admin: { readOnly: true } },
  ],
}
