/**
 * YOUNGO Hub Privacy Notice — the platform-specific notice shown at registration.
 *
 * This is NOT a replacement for the YOUNGO Data Protection Policy (adopted by the
 * constituency, held on the official policies Drive). This notice explains what
 * *this platform* does with the data it collects, as required before asking a
 * person to consent to that processing.
 *
 * Shared by the client (/privacy page, registration consent step) and the server
 * (consent validation and recording), so the version a member consented to is the
 * version the server stores.
 *
 * PRIVACY_VERSION must bump whenever the substance changes — what is collected,
 * why, who can see it, how long it is kept, or who processes it. Bumping it means
 * existing members are asked to review and re-consent.
 *
 * ── Council-confirmable facts ───────────────────────────────────────────────
 * The values in PRIVACY_META are the operational commitments this notice makes.
 * They are drawn from the adopted YOUNGO Membership Policy (Issue 2) where it
 * already speaks — §1.3 changes, §2.1 resignation, §2.2 expiration, §2.3
 * termination — and are otherwise the YOUNGO Hub Team's proposed defaults,
 * pending Council confirmation via the establishment DMP.
 */

export const PRIVACY_VERSION = 'v1-2026-07-24'

export const PRIVACY_META = {
  name: 'YOUNGO Hub Privacy Notice',
  version: PRIVACY_VERSION,
  effectiveFrom: '24 July 2026',
  status: 'Proposed — pending Council approval via the YOUNGO Hub establishment DMP',
  controller: 'YOUNGO — the Children and Youth Constituency of the UNFCCC',
  operatedBy: 'YOUNGO Hub Team, accountable to YOUNGO Council',
  contactEmail: 'membership@youngoclimate.org',
  altContactEmail: 'youngomembership@gmail.com',
  /** Infrastructure providers that process data on YOUNGO's behalf. */
  processors: [
    {
      name: 'Railway',
      role: 'Application hosting and managed PostgreSQL database',
      href: 'https://railway.com/legal/privacy',
    },
  ],
  relatedPolicies: [
    {
      label: 'YOUNGO Data Protection Policy',
      slug: 'dataProtection',
    },
    {
      label: 'YOUNGO Membership Policy',
      slug: 'membership',
    },
    {
      label: 'YOUNGO Child Safeguarding Policy',
      slug: 'childSafeguarding',
    },
  ],
}

/**
 * What the platform collects, why, and who can see it.
 * Rendered as the core table of the notice — keep it exhaustive and truthful.
 * If a registration field is added, it must be added here in the same change.
 */
export const DATA_CATEGORIES = [
  {
    id: 'identity',
    label: 'Who you are',
    fields: ['First and last name', 'Email address', 'Phone number'],
    purpose: 'To create your account, sign you in, and let contact points reach you about the work you join.',
    whoSees: 'You, YOUNGO Hub admins, and the Membership Team. Contact points see the name and email of members who join their working group.',
  },
  {
    id: 'eligibility',
    label: 'Whether you are eligible to join',
    fields: ['Date of birth', 'Age band'],
    purpose:
      'YOUNGO membership is for children and youth up to 35. Your date of birth is used to check eligibility, to determine whether guardian permission is required, and to apply the membership expiry in the Membership Policy §2.2.',
    whoSees: 'YOUNGO Hub admins and the Membership Team. Never shown to other members and never returned by Hub search.',
  },
  {
    id: 'guardian',
    label: 'Guardian permission (only if you are under 18)',
    fields: ['Guardian name', 'Guardian email', 'Confirmation that permission was given'],
    purpose:
      'Required by the Membership Policy §1 for members under 18, and by the Child Safeguarding Policy. Collected only when your date of birth indicates you are under 18.',
    whoSees:
      'YOUNGO Hub admins and the Membership Team only. Never shown to other members, never shown to contact points, and never returned by Hub search.',
  },
  {
    id: 'location',
    label: 'Where you are',
    fields: ['UN region', 'Nationality', 'Country of residence'],
    purpose:
      'To report regional balance across the constituency, to run regionally fair selection processes, and to plan calls across time zones.',
    whoSees: 'YOUNGO Hub admins and the Membership Team. Reported to the constituency only as aggregate counts, never as a list of individuals.',
  },
  {
    id: 'background',
    label: 'Background information you choose to give',
    fields: ['Gender', 'Minority groups you identify with', 'Why you want to join'],
    purpose:
      'To understand who the constituency is reaching and who it is not, so inclusion work is based on evidence. These fields are optional except where the form marks them required.',
    whoSees:
      'YOUNGO Hub admins and the Membership Team, as aggregate statistics wherever possible. Never shown to other members and never returned by Hub search.',
  },
  {
    id: 'organisation',
    label: 'Your organisation (only if you register one)',
    fields: [
      'Organisation name, country, website and social links',
      'Mission and activities',
      'UNFCCC Designated Contact Point and YOUNGO Contact Point details',
    ],
    purpose:
      'To register the organisation as a YOUNGO member and to route UNFCCC-facing requests such as badge and submission support to the right contact.',
    whoSees: 'YOUNGO Hub admins, the Membership Team, and the organisation’s own seat holders.',
  },
  {
    id: 'account',
    label: 'Your account and activity on the platform',
    fields: [
      'Password (stored only as a cryptographic hash)',
      'Sign-in sessions (stored hashed)',
      'Course completion and score',
      'Working groups you join',
      'Messages you send to contact points',
      'Administrative actions, recorded in the governance audit log',
    ],
    purpose:
      'To keep your account secure, to record that you completed the membership course, and to keep an accountable record of role and permission changes.',
    whoSees:
      'Nobody can see your password — it is not stored in a readable form, and administrators cannot recover it. Messages are visible only to you and the person you are messaging.',
  },
  {
    id: 'agreements',
    label: 'What you agreed to and when',
    fields: [
      'Membership Policy version you accepted',
      'Code of Conduct, Data Protection, Principles and Conflict of Interest agreements',
      'This Privacy Notice version, and the date you consented to it',
    ],
    purpose:
      'So that both you and YOUNGO have a record of exactly which version of each document you agreed to, and when.',
    whoSees: 'You and YOUNGO Hub admins.',
  },
]

/** The substantive sections of the notice, rendered after the data table. */
export const PRIVACY_SECTIONS = [
  {
    id: 'who',
    heading: 'Who is responsible for your data',
    paragraphs: [
      'YOUNGO — the Children and Youth Constituency of the UNFCCC — is responsible for the personal data collected through the YOUNGO Hub. The platform is operated day to day by the YOUNGO Hub Team, which is accountable to YOUNGO Council.',
      'If you want to reach a person about anything in this notice, email membership@youngoclimate.org. You do not need to give a reason.',
    ],
  },
  {
    id: 'why-consent',
    heading: 'Why we ask for your consent separately',
    paragraphs: [
      'Accepting the Membership Policy tells you what membership in YOUNGO means. It is not the same thing as agreeing to let this platform hold your personal data.',
      'So we ask for those separately. You read this notice, then you give a distinct consent, and we record which version of this notice you consented to and when. If this notice changes in substance, we ask you again rather than assuming your old answer still applies.',
    ],
  },
  {
    id: 'minors',
    heading: 'If you are under 18',
    paragraphs: [
      'If your date of birth shows you are under 18, the registration form will not let you finish without a guardian’s name, a guardian’s email, and a confirmation that your guardian has given permission. This follows the Membership Policy §1 and the YOUNGO Child Safeguarding Policy.',
      'Guardian details are visible only to YOUNGO Hub admins and the Membership Team. They are not shown to other members, not shown to working group contact points, and never returned by search on the platform.',
      'A guardian can withdraw permission at any time by emailing membership@youngoclimate.org, and the account will be closed and the data deleted.',
    ],
  },
  {
    id: 'who-sees',
    heading: 'Who can see your information',
    bullets: [
      {
        label: 'Other members',
        items: [
          'Your name, and the working groups you have joined',
          'Nothing else — not your date of birth, phone number, background information, guardian details, or motivation',
        ],
      },
      {
        label: 'Working group contact points',
        items: ['The name and email of members who join their own working group, so they can coordinate the work'],
      },
      {
        label: 'YOUNGO Hub admins and the Membership Team',
        items: [
          'The full member record, in order to verify membership and administer the constituency',
          'Never your password — it is stored only as a cryptographic hash and cannot be read or recovered by anyone',
        ],
      },
      {
        label: 'Nobody outside YOUNGO',
        items: [
          'Your data is not sold, rented, or shared with third parties for their own purposes',
          'It is not used for advertising, and there is no advertising or third-party tracking on this platform',
          'It is shared with the UNFCCC secretariat only where you have asked YOUNGO to act for you — for example a badge or submission request — and only what that request needs',
        ],
      },
    ],
  },
  {
    id: 'search',
    heading: 'What the Hub’s search and intelligence features can never reach',
    paragraphs: [
      'The Hub has a search feature that answers questions from YOUNGO’s documented record. It is walled off from personal data by design, not by convention.',
      'Account records, passwords, sessions, private messages, guardian details, background and minority information, and personal email and phone fields are excluded from what it can retrieve — for every user, including administrators. Queries against it are logged so that the exclusion can be audited rather than taken on trust.',
    ],
  },
  {
    id: 'retention',
    heading: 'How long your data is kept',
    paragraphs: [
      'While your membership is active, your account stays open and your record is kept up to date.',
      'When membership ends, the adopted Membership Policy already sets the timelines the Hub follows:',
    ],
    bullets: [
      {
        label: 'On the timelines in the Membership Policy',
        items: [
          'Resignation — you email the Membership Team, and you are removed from all YOUNGO services within one month (§2.1)',
          'Expiration — individual membership expires at 35; expired members are removed from YOUNGO services at least monthly (§2.2)',
          'Termination — where membership is terminated under the Code of Conduct, removal is immediate (§2.3)',
        ],
      },
      {
        label: 'What the Hub does on top of that',
        items: [
          'Your Hub account is closed and your personal record deleted when you are removed from YOUNGO services',
          'Guardian permission records are deleted when the account is closed, or when you turn 18 and they are no longer needed',
          'Dormant accounts that never completed the membership course are deleted after 24 months without a sign-in',
          'The governance audit log keeps a record that an action happened and who took it, because accountability requires it — but not the personal details of the member concerned',
        ],
      },
    ],
  },
  {
    id: 'rights',
    heading: 'What you can ask for',
    paragraphs: [
      'These are yours to exercise at any time, and using them is never held against you.',
    ],
    bullets: [
      {
        label: 'You can ask to',
        items: [
          'See a copy of the data the Hub holds about you',
          'Correct anything that is wrong — the Membership Policy §1.3 already provides for this by email',
          'Delete your account and your data',
          'Withdraw this consent, which closes your Hub account; withdrawing does not by itself end your YOUNGO membership, which is a separate process with the Membership Team',
          'Object to a particular use of your data, or ask for an explanation of it',
          'Raise a concern with YOUNGO Council if you are not satisfied with how the Hub Team answered you',
        ],
      },
    ],
    paragraphsAfter: [
      'Email membership@youngoclimate.org for any of these. The Hub Team aims to answer within 30 days, and will tell you if it needs longer.',
    ],
  },
  {
    id: 'security',
    heading: 'How your data is protected',
    bullets: [
      {
        label: 'In place today',
        items: [
          'Passwords are stored only as cryptographic hashes — administrators cannot see or recover them',
          'Sign-in sessions are stored hashed, in cookies that scripts on the page cannot read',
          'Password reset links are single-use, expire after one hour, and are stored hashed',
          'Access is role-based: contact points, organisation seats, and administrators each see only what their role requires',
          'Role and permission changes are written to a governance audit log',
          'The connection to the platform is encrypted in transit',
        ],
      },
    ],
    paragraphsAfter: [
      'No system is perfectly secure. If a breach affects your personal data, the Hub Team will notify affected members and report to YOUNGO Council without undue delay.',
    ],
  },
  {
    id: 'where',
    heading: 'Where your data is held',
    paragraphs: [
      'The platform and its database are hosted on Railway, a cloud infrastructure provider, which processes the data on YOUNGO’s behalf and under its instructions. Railway does not use YOUNGO member data for its own purposes.',
      'Because the constituency is global, data may be processed outside your own country. Access remains restricted to the roles described above wherever it is hosted.',
    ],
  },
  {
    id: 'changes',
    heading: 'If this notice changes',
    paragraphs: [
      'Every version of this notice carries a version identifier, and the version you consented to is recorded against your account.',
      'If what is collected, why, who can see it, how long it is kept, or who processes it changes, the version is bumped and you are asked to review and consent again. You will not be quietly moved onto new terms.',
      'Any change that affects what personal data is collected goes back to YOUNGO Council before it takes effect.',
    ],
  },
]

/** The exact sentence a person consents to at registration. Recorded verbatim alongside the version. */
export const CONSENT_STATEMENT =
  'I have read the YOUNGO Hub Privacy Notice and I consent to YOUNGO collecting and using my personal data as it describes.'

/** Short plain-language points shown next to the consent checkbox, so consent is informed even without opening the full notice. */
export const CONSENT_SUMMARY = [
  'What is collected: your name, contact details, date of birth, location, and the background information you choose to give.',
  'Why: to run your membership, check eligibility, and connect you to the right working groups.',
  'Who sees it: other members see only your name and working groups. Admins and the Membership Team see your full record. Nobody outside YOUNGO.',
  'How long: for as long as your membership is active, then deleted on the timelines in the Membership Policy.',
  'You can ask to see, correct, or delete your data at any time by emailing membership@youngoclimate.org.',
]
