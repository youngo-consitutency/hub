/**
 * YOUNGO Membership Policy — Issue 2 (adopted 03 Feb 2025, updated 04 May 2025).
 * Source: YOUNGO Membership Policy [UPDATED 2025].
 *
 * POLICY_VERSION must bump when the legal text changes so returning users
 * re-ack the new mandate.
 */
export const POLICY_VERSION = 'issue-2-2025-05-04'

export const POLICY_META = {
  name: 'YOUNGO Membership Policy',
  issue: 'Issue 2',
  owner: 'January Reforms Review Task Force',
  adoptedOn: '03 February 2025',
  updatedOn: '04 May 2025',
  lastReviewedOn: '04 May 2025',
  adoptedBy: 'YOUNGO Constituency',
  contactEmail: 'membership@youngoclimate.org',
  translations: [
    { lang: 'French', href: 'https://docs.google.com/document/d/1IxOzXjgDdzrfGMTfjvreg8xAXY0yYCnhHvnhm4an3iI/edit?tab=t.0' },
    { lang: 'Spanish', href: 'https://docs.google.com/document/d/18kpOzCLwjAPmo4oy_mV5ivw-wFg2M-ZADGmOZWnZiZE/edit?usp=sharing' },
    { lang: 'Portuguese', href: 'https://docs.google.com/document/d/1WWOcbku3p1F6yY_-Ow-KkmxZ3ktBLLfq9YwM1_ZrOgk/edit?usp=sharing' },
    { lang: 'Chinese (simplified)', href: 'https://docs.google.com/document/d/1QmyQ6HM-RIKATkLQRRuT0McbytCdxViQI15i3zjgda0/edit?usp=sharing' },
    { lang: 'Russian', href: 'https://docs.google.com/document/d/1bDZE-J8FhQsGiQGr9RklnljuWkmIP2CCRYv74bYSUAY/edit?usp=sharing' },
    { lang: 'Arabic', href: 'https://docs.google.com/document/d/1Exxxopnb2F7et-P00J4i8PUzW0wJoqfaxnMv5uwRgME/edit?usp=sharing' },
  ],
  related: [
    { label: 'YOUNGO Governance Policy', href: 'https://docs.google.com/document/d/14O2gGBauihIEzIAR5iENUurJ9nkBZcO5xJTPGjpbeHQ/view' },
    { label: 'All policies (Drive folder)', href: 'https://drive.google.com/drive/folders/1z7WAwxkJOzNaTlccZ4vr2fMn7vvXtReA' },
    { label: 'Library catalog', href: '/library' },
  ],
  officialSource: {
    label: 'YOUNGO Membership Policy [UPDATED 2025]',
    href: 'https://docs.google.com/document/d/19Up9-sErBOLHvFwu1kD_SH-T6N96cLj_9SaE4hb52lc/view',
  },
}

/** Plain-language analysis of the membership mandate for first-time visitors. */
export const MANDATE_ANALYSIS = {
  title: 'What membership means in YOUNGO',
  lede:
    'YOUNGO is the Children and Youth Constituency of the UNFCCC. It groups youth NGOs admitted to the UNFCCC and engaged in international climate negotiations — and also welcomes non-NGO youth groupings and individual youth who face barriers to the formal observer system.',
  points: [
    {
      title: 'Who can join',
      body:
        'Children and youth-led organisations, collectives, associations, movements, UNFCCC-admitted NGOs affiliated with the Youth Constituency that advance climate action and future generations’ rights — or any young person aged 34 and under.',
    },
    {
      title: 'Two membership tracks',
      body:
        'YOUNGO Network is the open engagement layer (updates, actions, sharing, light support). Constituency Work is the deeper layer: internal coordination, WGs/OTs/task forces, policy and advocacy, Workspace access, decision-making, and eligibility for mandated roles — after formal onboarding.',
    },
    {
      title: 'Duties that come with membership',
      body:
        'All engagement must follow YOUNGO Principles, Code of Conduct, Safeguarding, Child Safeguarding, and Conflict of Interest policies. You may only speak or act for YOUNGO if selected through a formal process. Conflicts of interest must be declared at registration.',
    },
    {
      title: 'How Constituency Work stays current',
      body:
        'Onboarding runs every July and December. Constituency Work membership must be renewed every February (one-month window). Miss it and you drop back to the Network; you can rejoin via the normal process.',
    },
    {
      title: 'How membership ends',
      body:
        'Resignation (email the Membership Team), expiration (individual membership ends at age 35; Constituency Work expires if not renewed), or termination for policy violations. On exit, YOUNGO data must be handed over within two weeks.',
    },
  ],
}

/** Structured full policy text for the mandatory read surface. */
export const POLICY_SECTIONS = [
  {
    id: 'preamble',
    heading: 'Preamble',
    paragraphs: [
      'YOUNGO, as the Children and Youth Constituency of the UNFCCC, groups all youth NGOs admitted to the UNFCCC and engaged in international climate negotiations.',
      'YOUNGO aims to give a voice to all children and youth worldwide who are concerned about climate change, and recognizes that many of them face significant barriers to engaging through the UNFCCC’s observer mechanism. Therefore, it also welcomes the membership of non-NGO youth groupings as well as individual youth who wish to engage and contribute in its efforts to achieve a livable planet for current and future generations.',
      'The following Policy defines membership in YOUNGO.',
    ],
  },
  {
    id: 's1',
    heading: '§1 Registration',
    paragraphs: [
      'Every children and youth-led organisation, collective, association, movement, etc. or all UNFCCC admitted NGO which have indicated affiliation with the “Youth Constituency”, that work to promote ambitious climate action and protect the rights of future generations, or any young person who is 34 years old and under can register to become a YOUNGO member by filling out the membership registration form.',
      'Organisations must name a Designated Contact Point (DCP), who must be an individual member and thus fulfill the individual membership requirements. In case an admitted NGO’s official Designated Contact Point to UNFCCC does not fulfill individual membership requirements, the NGO must assign a YOUNGO-specific Representative who meets the individual membership requirements.',
      'Individuals and organisations must declare any potential conflicts of interest, according to the respective Policy, at the time of registration. Failure to do so can lead to non-admission or termination of membership.',
      'In addition to the above requirements, individuals under 18 years old must also provide a signed Guardian Consent Form as part of their registration.',
    ],
  },
  {
    id: 's1-1',
    heading: '§1.1 Types of membership',
    paragraphs: [
      'Every member has the right to engage virtually and physically in YOUNGO’s events (including but not limited to YOUNGO’s daily coordination meeting at Conferences, side events, and L/R/GCOY). In all engagements members must adhere to YOUNGO’s policies and guidelines, including but not limited to its Principles, Code of Conduct, Safeguarding Policy, Child Safeguarding Policy, and Conflict of Interest Policy.',
      'Individuals and organisations can choose to become either Members of the YOUNGO Network or Members of the Constituency Work.',
    ],
    bullets: [
      {
        label: 'Members of the YOUNGO Network',
        items: [
          'Receive regular update newsletters',
          'Participate in YOUNGO actions, campaigns, events and opportunities',
          'Share their own actions, campaigns, events and opportunities',
          'Share information with and provide advice to the Constituency Work Members',
          'Receive, upon request, support in navigating the UNFCCC admission process for NGOs (priority for NGOs led by marginalized children and youth and NGOs from developing countries as defined by the UNFCCC)',
        ],
      },
      {
        label: 'Members of the Constituency Work',
        items: [
          'All rights of YOUNGO Network members, plus:',
          'Participate in the internal organisation and coordination work of YOUNGO and its teams',
          'Participate in Working Groups, Operational Teams and ad-hoc Task Forces',
          'Contribute to policy work and assist in providing strategic direction',
          'Contribute to intervention texts, bilaterals and other advocacy work',
          'Receive a YOUNGO Google Workspace account',
          'Receive, upon request and depending on resources, translation and interpretation in all UN languages, as well as plain language and child-friendly versions for onboarding and crucial decision-making documents',
          'Participate in decision-making according to the Governance Policy and YOUNGO Decision-Making Processes',
          'Apply for mandated roles within the constituency (liaisons, contact points, focal points, etc.) according to applicable selection guidelines',
        ],
      },
    ],
    paragraphsAfter: [
      'Members may only speak or act on behalf of YOUNGO, as a whole or in parts (e.g. Working Groups), if selected through a formal process according to YOUNGO’s guidelines.',
      'People who register to join Constituency Work must complete an onboarding before being able to join and receive access to all benefits. Onboarding is conducted by the Membership Team every July and December to ensure new members have time to contribute meaningfully prior to major Conferences.',
    ],
  },
  {
    id: 's1-2',
    heading: '§1.2 Renewal',
    paragraphs: [
      'Members of the Constituency Work must renew their membership in Constituency Work every February. The Membership Team will request all Constituency Work members to reconfirm their membership within one (1) month of the request.',
      'Failure to renew membership will lead to the expiration of membership in Constituency Work. Members will continue to be part of the YOUNGO Network and can rejoin the Constituency Work through the process outlined in §1.1.',
      'For the purpose of counting the amount of years a member has been in Constituency Work, only their last joining date will be used. A grace period is given for members who do not reconfirm their membership in February, but rejoin the Constituency Work in July.',
    ],
  },
  {
    id: 's1-3',
    heading: '§1.3 Changes',
    paragraphs: [
      'If a member wishes to change any of their registration information, they can do so by emailing the membership team at membership@youngoclimate.org.',
    ],
  },
  {
    id: 's2',
    heading: '§2 End of membership',
    paragraphs: [
      'Membership can end through resignation, expiration, or termination.',
      'In all cases members must hand over all YOUNGO data within 2 weeks of the notice of the end of their membership.',
    ],
  },
  {
    id: 's2-1',
    heading: '§2.1 Resignation',
    paragraphs: [
      'Members can voluntarily resign at any point by emailing the Membership Team at membership@youngoclimate.org.',
      'The Membership Team will remove the member from all YOUNGO services within one (1) month of the receipt of the request.',
    ],
  },
  {
    id: 's2-2',
    heading: '§2.2 Expiration',
    paragraphs: [
      'Individual membership expires by the birthday on which the member turns 35 years old or in case of the death.',
      'Membership of Constituency Work expires when a member fails to renew their membership as described in §1.2.',
      'The Membership Team will remove members whose membership has expired from all YOUNGO services on a regular basis, at least once a month.',
    ],
  },
  {
    id: 's2-3',
    heading: '§2.3 Termination',
    paragraphs: [
      "Members who are found to have violated YOUNGO's policies may be subject to termination of their membership according to the Code of Conduct and other relevant policies.",
      'The Membership Team will remove the member from all YOUNGO services immediately.',
    ],
  },
  {
    id: 's3',
    heading: '§3 Implementation',
    paragraphs: [
      'The Membership Team is responsible for maintaining the registration form and the associated registry of members, conducting onboarding calls every July and December, as well as carrying out any other tasks associated with the implementation of this policy.',
    ],
  },
]
