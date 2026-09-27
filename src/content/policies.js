/**
 * Official YOUNGO Policies & Guidelines catalogue.
 * Source of truth: public Google Drive folder (not mirrored into the hub).
 * Hub points members back to Drive — it does not replace it.
 *
 * Folder: https://drive.google.com/drive/folders/1z7WAwxkJOzNaTlccZ4vr2fMn7vvXtReA
 * IDs scraped from that folder listing (2026-07-18). Re-verify if docs move.
 */

export const POLICIES_FOLDER = {
  id: '1z7WAwxkJOzNaTlccZ4vr2fMn7vvXtReA',
  title: 'YOUNGO Policies and Guidelines',
  href: 'https://drive.google.com/drive/folders/1z7WAwxkJOzNaTlccZ4vr2fMn7vvXtReA',
  translationsFolder: {
    id: '1j4d8mCzP1-ysUh6WDdgMFB4WwLMShEx3',
    title: 'YOUNGO Policies Translations',
    href: 'https://drive.google.com/drive/folders/1j4d8mCzP1-ysUh6WDdgMFB4WwLMShEx3',
  },
}

/** @typedef {'doc'|'pdf'|'image'|'folder'} PolicyKind */
/** @typedef {{ id: string, title: string, kind: PolicyKind, category: string, year?: number, href: string, note?: string }} PolicyDoc */

function driveFile(id) {
  return `https://drive.google.com/file/d/${id}/view`
}

function googleDoc(id) {
  return `https://docs.google.com/document/d/${id}/view`
}

/** Core English policies + mandates from the official folder (excludes translation copies). */
export const OFFICIAL_POLICIES = /** @type {PolicyDoc[]} */ ([
  // Conduct & safeguarding
  {
    id: '1PRk4PYmcVoE37ZTKoW-0HAPTMTRIahLy3qTTeSqRI9o',
    title: 'YOUNGO Principles',
    kind: 'doc',
    category: 'conduct',
    year: 2021,
    href: googleDoc('1PRk4PYmcVoE37ZTKoW-0HAPTMTRIahLy3qTTeSqRI9o'),
  },
  {
    id: '1RRM-kLzxZHhy2J4hwkjkZDuH19YPwJTriFq7lbDnopI',
    title: 'YOUNGO Code of Conduct',
    kind: 'doc',
    category: 'conduct',
    year: 2025,
    href: googleDoc('1RRM-kLzxZHhy2J4hwkjkZDuH19YPwJTriFq7lbDnopI'),
  },
  {
    id: '1w3JRz2thInmgtCAYKKsyX2Hz2hwCd1qycgaPglkpL1s',
    title: 'YOUNGO Safeguarding Policy',
    kind: 'doc',
    category: 'conduct',
    year: 2025,
    href: googleDoc('1w3JRz2thInmgtCAYKKsyX2Hz2hwCd1qycgaPglkpL1s'),
  },
  {
    id: '1lGxfcMKQlXuINDYzVga38DibnLwMTfkSyNXaNbTf_w4',
    title: 'YOUNGO Child Safeguarding Policy',
    kind: 'doc',
    category: 'conduct',
    year: 2024,
    href: googleDoc('1lGxfcMKQlXuINDYzVga38DibnLwMTfkSyNXaNbTf_w4'),
  },
  {
    id: '1LfvWGPF0nvGe54h_A8iFMxq_wn3IlVjiQEpdW0c5Gg0',
    title: 'YOUNGO Conflict of Interest Policy',
    kind: 'doc',
    category: 'conduct',
    year: 2024,
    href: googleDoc('1LfvWGPF0nvGe54h_A8iFMxq_wn3IlVjiQEpdW0c5Gg0'),
  },
  {
    id: '1AagyoPzGAbG4c_7DnanjlE8rp1jzreQrYG4H74bDiZI',
    title: 'YOUNGO Data Protection Policy',
    kind: 'doc',
    category: 'conduct',
    year: 2024,
    href: googleDoc('1AagyoPzGAbG4c_7DnanjlE8rp1jzreQrYG4H74bDiZI'),
  },
  {
    id: '10QCVp8XgG-PUhr3s0FhINj-QZcEt3qQGsKmMp0_6NRY',
    title: 'YOUNGO Awareness Team Guidelines',
    kind: 'doc',
    category: 'conduct',
    year: 2020,
    href: googleDoc('10QCVp8XgG-PUhr3s0FhINj-QZcEt3qQGsKmMp0_6NRY'),
  },
  {
    id: '1FVTcaYiXy__rekgr00mqK2s2xLlnTEpNIXYbhUpP_IE',
    title: 'GCT Agreement for a Healthy Working Atmosphere',
    kind: 'doc',
    category: 'conduct',
    year: 2021,
    href: googleDoc('1FVTcaYiXy__rekgr00mqK2s2xLlnTEpNIXYbhUpP_IE'),
  },

  // Membership & selection
  {
    id: '19Up9-sErBOLHvFwu1kD_SH-T6N96cLj_9SaE4hb52lc',
    title: 'YOUNGO Membership Policy',
    kind: 'doc',
    category: 'membership',
    year: 2025,
    href: googleDoc('19Up9-sErBOLHvFwu1kD_SH-T6N96cLj_9SaE4hb52lc'),
    note: 'Also summarised in-hub under Onboarding.',
  },
  {
    id: '1HBC9UPl_5fZRzvTBH5qvcBtN8KATAv0CAkzzy15evqM',
    title: 'YOUNGO Selection Guidelines',
    kind: 'doc',
    category: 'membership',
    year: 2025,
    href: googleDoc('1HBC9UPl_5fZRzvTBH5qvcBtN8KATAv0CAkzzy15evqM'),
  },
  {
    id: '1ro3fAeoUeFemqPPAIEItYHDYsCpqicRdLYbAaJAE1E4',
    title: 'YOUNGO Election Process Guidelines',
    kind: 'doc',
    category: 'membership',
    year: 2018,
    href: googleDoc('1ro3fAeoUeFemqPPAIEItYHDYsCpqicRdLYbAaJAE1E4'),
  },

  // Governance & decision-making
  {
    id: '14O2gGBauihIEzIAR5iENUurJ9nkBZcO5xJTPGjpbeHQ',
    title: 'YOUNGO Governance Policy',
    kind: 'doc',
    category: 'governance',
    year: 2025,
    href: googleDoc('14O2gGBauihIEzIAR5iENUurJ9nkBZcO5xJTPGjpbeHQ'),
  },
  {
    id: '10iD0yQ57jMMKm-E2WQ2Amjk8_COvFi3PLjuW2QrxzfE',
    title: 'YOUNGO Decision-Making Processes',
    kind: 'doc',
    category: 'governance',
    year: 2025,
    href: googleDoc('10iD0yQ57jMMKm-E2WQ2Amjk8_COvFi3PLjuW2QrxzfE'),
  },
  {
    id: '1-BpTZk6uajiOSU4HhsE_FgJuhCzZpOiq',
    title: 'Decision-Making Processes Summary (diagram)',
    kind: 'image',
    category: 'governance',
    year: 2025,
    href: driveFile('1-BpTZk6uajiOSU4HhsE_FgJuhCzZpOiq'),
  },
  {
    id: '1tURwQ4v4GBS1ATSkQih8RD3PUiLEE99VFigHWsGiNM4',
    title: 'YOUNGO Reforms Standard Operating Process',
    kind: 'doc',
    category: 'governance',
    year: 2025,
    href: googleDoc('1tURwQ4v4GBS1ATSkQih8RD3PUiLEE99VFigHWsGiNM4'),
  },

  // Roles & mandates
  {
    id: '1t0di28Ov2LjhuXOPO2SVWAGnTTrmhINDizQ9F-vXS90',
    title: 'YOUNGO Focal Point Mandate',
    kind: 'doc',
    category: 'mandates',
    year: 2014,
    href: googleDoc('1t0di28Ov2LjhuXOPO2SVWAGnTTrmhINDizQ9F-vXS90'),
  },
  {
    id: '10Jac8nLW3pqgHiT9bTAlvhP3MjXjL6-NYwjS-IUBhes',
    title: 'YOUNGO Working Group Contact Point Mandate',
    kind: 'doc',
    category: 'mandates',
    year: 2025,
    href: googleDoc('10Jac8nLW3pqgHiT9bTAlvhP3MjXjL6-NYwjS-IUBhes'),
  },
  {
    id: '1FKwyUTeSbNQo-cSFhEgMXhCq8kYEqzAhqJWc769wf68',
    title: 'YOUNGO Interim Global Coordination Team Mandate',
    kind: 'doc',
    category: 'mandates',
    year: 2025,
    href: googleDoc('1FKwyUTeSbNQo-cSFhEgMXhCq8kYEqzAhqJWc769wf68'),
  },
  {
    id: '1KAoMuexXHHYuhpG6cQ3MnaWc8vkeI4VnLizeg1TAajg',
    title: 'YOUNGO COP30 Conference Coordination Team Mandate',
    kind: 'doc',
    category: 'mandates',
    year: 2025,
    href: googleDoc('1KAoMuexXHHYuhpG6cQ3MnaWc8vkeI4VnLizeg1TAajg'),
  },

  // Conferences of Youth
  {
    id: '1zmgjY3QWf7xTG9gS89X33jzs1uQKXUZqKSXvEylle4A',
    title: 'YOUNGO Local Conferences Of Youth (LCOY) Policy',
    kind: 'doc',
    category: 'conferences',
    href: googleDoc('1zmgjY3QWf7xTG9gS89X33jzs1uQKXUZqKSXvEylle4A'),
  },
  {
    id: '19VzHvP3MRZycfjZO6wY6XI8h5vkfIjydPdR6ezR35iA',
    title: 'YOUNGO Regional Conference of Youth (RCOY) Policy',
    kind: 'doc',
    category: 'conferences',
    year: 2026,
    href: googleDoc('19VzHvP3MRZycfjZO6wY6XI8h5vkfIjydPdR6ezR35iA'),
  },
  {
    id: '1zCg0rCIo1oajla2Uj_F7JDmC1w_piEdCgBGN4vnQdXQ',
    title: 'YOUNGO L/R/GCOY Liaison Guidelines',
    kind: 'doc',
    category: 'conferences',
    year: 2024,
    href: googleDoc('1zCg0rCIo1oajla2Uj_F7JDmC1w_piEdCgBGN4vnQdXQ'),
  },
  {
    id: '16QnzlMrzFR9NgzVYgNG-s71K0UQnbkSC',
    title: 'YOUNGO Youth Pavilion Guiding Principles',
    kind: 'pdf',
    category: 'conferences',
    year: 2022,
    href: driveFile('16QnzlMrzFR9NgzVYgNG-s71K0UQnbkSC'),
  },

  // Operations
  {
    id: '1gqu3ztwxILkKFGGH8jxIKRVJ4F-kigsm7CTeBCdDEpM',
    title: 'YOUNGO Communication and Work Tools Policy',
    kind: 'doc',
    category: 'operations',
    year: 2024,
    href: googleDoc('1gqu3ztwxILkKFGGH8jxIKRVJ4F-kigsm7CTeBCdDEpM'),
  },
  {
    id: '1KYF6d172hEwLS2EVEBPN0swzZ009CmspS-C3dVV44ZE',
    title: 'YOUNGO Funding Guidelines',
    kind: 'doc',
    category: 'operations',
    year: 2025,
    href: googleDoc('1KYF6d172hEwLS2EVEBPN0swzZ009CmspS-C3dVV44ZE'),
  },
  {
    id: '1bv6BxC53T5i3EYauZdgvhpjNnmnBnNpESDwnRcrSdNI',
    title: 'YOUNGO Pool Badges Allocation Policy',
    kind: 'doc',
    category: 'operations',
    year: 2018,
    href: googleDoc('1bv6BxC53T5i3EYauZdgvhpjNnmnBnNpESDwnRcrSdNI'),
  },
  {
    id: '1JUQuzdnmTExB7J4tTeDZ0z7UXWZBvB3X',
    title: 'YOUNGO Recognition Certificates and Letters Guidelines',
    kind: 'doc',
    category: 'operations',
    year: 2019,
    href: driveFile('1JUQuzdnmTExB7J4tTeDZ0z7UXWZBvB3X'),
    note: 'Word file in Drive.',
  },
])

export const POLICY_CATEGORIES = [
  { id: 'conduct', label: 'Conduct & safeguarding' },
  { id: 'membership', label: 'Membership & selection' },
  { id: 'governance', label: 'Governance & decisions' },
  { id: 'mandates', label: 'Roles & mandates' },
  { id: 'conferences', label: 'Conferences of Youth' },
  { id: 'operations', label: 'Operations & tools' },
]

/** Quick lookups used by gates / course copy. */
export const POLICY_BY_SLUG = {
  principles: OFFICIAL_POLICIES.find(
    (p) => p.id === '1PRk4PYmcVoE37ZTKoW-0HAPTMTRIahLy3qTTeSqRI9o',
  ),
  codeOfConduct: OFFICIAL_POLICIES.find(
    (p) => p.id === '1RRM-kLzxZHhy2J4hwkjkZDuH19YPwJTriFq7lbDnopI',
  ),
  safeguarding: OFFICIAL_POLICIES.find(
    (p) => p.id === '1w3JRz2thInmgtCAYKKsyX2Hz2hwCd1qycgaPglkpL1s',
  ),
  childSafeguarding: OFFICIAL_POLICIES.find(
    (p) => p.id === '1lGxfcMKQlXuINDYzVga38DibnLwMTfkSyNXaNbTf_w4',
  ),
  conflictOfInterest: OFFICIAL_POLICIES.find(
    (p) => p.id === '1LfvWGPF0nvGe54h_A8iFMxq_wn3IlVjiQEpdW0c5Gg0',
  ),
  dataProtection: OFFICIAL_POLICIES.find(
    (p) => p.id === '1AagyoPzGAbG4c_7DnanjlE8rp1jzreQrYG4H74bDiZI',
  ),
  membership: OFFICIAL_POLICIES.find(
    (p) => p.id === '19Up9-sErBOLHvFwu1kD_SH-T6N96cLj_9SaE4hb52lc',
  ),
  governance: OFFICIAL_POLICIES.find(
    (p) => p.id === '14O2gGBauihIEzIAR5iENUurJ9nkBZcO5xJTPGjpbeHQ',
  ),
  decisionMaking: OFFICIAL_POLICIES.find(
    (p) => p.id === '10iD0yQ57jMMKm-E2WQ2Amjk8_COvFi3PLjuW2QrxzfE',
  ),
  focalPointMandate: OFFICIAL_POLICIES.find(
    (p) => p.id === '1t0di28Ov2LjhuXOPO2SVWAGnTTrmhINDizQ9F-vXS90',
  ),
}

export function policiesInCategory(categoryId) {
  return OFFICIAL_POLICIES.filter((p) => p.category === categoryId)
}
