/** Per-WG workspace onboarding copy (presentation + rules). */

export const WG_ONBOARDING = {
  default: {
    presentation: [
      'This Working Group coordinates thematic work inside YOUNGO — drafting, campaigns, and inputs to UNFCCC processes.',
      'Contact Points (CPs) facilitate calls and channels. Members contribute in good faith and respect YOUNGO policies.',
      'After you accept the rules, you unlock the WG module: WhatsApp (where available), CP contacts, and WG activities.',
    ],
    rules: [
      'Follow the YOUNGO Code of Conduct and Safeguarding policies in all WG spaces.',
      'Do not share private channel links outside YOUNGO membership without CP approval.',
      'Credit collective work; do not speak for the whole WG unless mandated.',
      'Flag conflicts of interest to the CP when relevant.',
    ],
  },
  finance: {
    presentation: [
      'Finance WG focuses on climate finance, NCQG follow-up, and youth access to funds.',
      'We track submissions, bilaterals context, and coordination around finance agenda items.',
      'CPs maintain the WhatsApp space and call cadence (often weekly).',
    ],
    rules: [
      'Keep finance-sensitive drafts inside agreed channels.',
      'Use inclusive language; centre climate justice and developing-country youth access.',
      'Coordinate public statements with CPs before using the YOUNGO name.',
    ],
  },
  ace: {
    presentation: [
      'ACE WG works on Action for Climate Empowerment — education, training, public participation, and access to information.',
    ],
    rules: [
      'Prioritise child- and youth-friendly communication.',
      'Coordinate ACE Dialogue and education-related inputs with the group.',
    ],
  },
  energy: {
    presentation: [
      'Energy WG works on a just energy transition — scaling renewables, phasing out fossil fuels, and energy access for young people and frontline communities.',
      'We track mitigation and energy agenda items, prepare submissions, and use open data like Climate Watch and the Climate Action Tracker to keep inputs evidence-based.',
      'CPs maintain the WhatsApp space and the biweekly call cadence.',
    ],
    rules: [
      'Ground claims in cited, verifiable sources when drafting submissions.',
      'Centre a just transition and the needs of fossil-fuel-dependent and energy-poor communities.',
      'Coordinate public statements with CPs before using the YOUNGO name.',
    ],
  },
}

export function getWgOnboarding(slug) {
  const base = WG_ONBOARDING.default
  const specific = WG_ONBOARDING[slug] || {}
  return {
    presentation: specific.presentation || base.presentation,
    rules: [...(specific.rules || []), ...base.rules],
  }
}
