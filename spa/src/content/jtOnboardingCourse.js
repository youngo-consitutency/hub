/**
 * Self-paced Just Transition WG onboarding.
 * Source decks (2026), ingested 2026-09-24:
 * - 2026 YOUNGO JTWG Onboarding (1nA00_UUd3Aw6zVx9tL7GcO9aFsDXIV1_Z-E6O1WxE_k)
 * - KCI Capacity Building, used as the teaching style and the response-measures briefing
 *   (1efM1laVI6k1bJtQlXQtMuwGq0FmYSOBxKDNOuXyBP84)
 * Speaker notes, personal emails, and one-off nominee lists stay out of the member path.
 */

export const JT_ONBOARDING_COURSE = {
  id: 'jtwg-2026-v1',
  title: 'Just Transition WG onboarding',
  brand: {
    label: 'Just Transition Working Group',
    mint: '#e7f6e4',
    forest: '#14632d',
    deep: '#0e4f24',
    lime: '#3c9a32',
    ink: '#24382c',
    muted: '#4d6556',
  },
  slides: [
    {
      id: 'welcome',
      layout: 'cover',
      kicker: '2026 onboarding',
      title: 'Welcome to Just Transition WG',
      body: [
        'YOUNGO Just Transition Working Group',
        'Just transition, green jobs, and the road to COP31.',
      ],
    },
    {
      id: 'why',
      layout: 'section',
      kicker: 'Why this group',
      title: 'Why Just Transition WG?',
      body: [
        'Countries act on climate change through policies, programmes, and investments. Those choices change work, communities, industries, and trade.',
        'Just transition is the work of handling those consequences fairly. This working group is where youth in YOUNGO coordinate on that.',
      ],
    },
    {
      id: 'structure',
      layout: 'cards',
      kicker: 'How the group is organised',
      title: 'Four places to contribute',
      body: [
        'The working group sits inside YOUNGO. Day-to-day work happens in teams, a taskforce, and cross-constituency partnerships.',
      ],
      points: [
        {
          label: 'Policy Team',
          text: 'Negotiations, submissions, interventions, and the Global Youth Statement.',
        },
        {
          label: 'Capacity Building Team',
          text: 'Makes the work understandable and brings members into decisions.',
        },
        {
          label: 'Fossil Fuel Phase-out Taskforce',
          text: 'Tracks the transition away from fossil fuels inside the group’s advocacy.',
        },
        {
          label: 'Cross-constituency work',
          text: 'Joint advocacy with other constituencies and with other YOUNGO groups.',
        },
      ],
    },
    {
      id: 'contact-points',
      layout: 'people',
      kicker: 'Who facilitates',
      title: 'Contact Points',
      body: [
        'Contact Points facilitate the whole working group. They connect sub-teams and partnerships, represent the group with other working groups and Focal Points, and are responsible for bringing members in and keeping a safe space.',
        'The 2026 Contact Points are Amany Darkaoui and Masagus Fathan. On the constituency roster Amany is listed as Imane Darkaoui.',
      ],
      points: [
        {
          label: 'Amany Darkaoui',
          text: 'Morocco. Statistical and applied mathematics; sustainable finance.',
        },
        {
          label: 'Masagus Fathan',
          text: 'Indonesia. Environmental systems engineering and GIS; energy research and advocacy with Indigenous Peoples and local communities.',
        },
      ],
    },
    {
      id: 'facilitators',
      layout: 'rows',
      kicker: 'Who facilitates',
      title: 'Sub-team facilitators',
      body: [
        'A facilitator runs one sub-team: meetings, a report back to the General Meeting, and the link to the Contact Points.',
      ],
      points: [
        {
          label: 'Policy Team',
          text: 'Luna, Rajia, and Doğukan.',
        },
        {
          label: 'Capacity Building Team',
          text: 'Priyanka and Abhinav.',
        },
        {
          label: 'Public updates',
          text: 'The group’s Linktree collects the public entry points.',
        },
      ],
      links: [
        {
          label: 'just.transition.youngo on Linktree',
          href: 'https://linktr.ee/just.transition.youngo',
        },
      ],
    },
    {
      id: 'policy',
      layout: 'cards',
      kicker: 'Policy, lobby and advocacy',
      title: 'How youth voice gets into the process',
      body: [
        'The Policy Team follows the negotiations. The work needs skill, a gathered youth voice, and preparation done before the room.',
      ],
      points: [
        {
          label: 'Interventions',
          text: 'Spoken youth lines in the negotiation room.',
        },
        {
          label: 'UNFCCC submissions',
          text: 'Written inputs on the work programme and the mechanism.',
        },
        {
          label: 'Bilaterals',
          text: 'Conversations with Parties and partners.',
        },
        {
          label: 'Global Youth Statement',
          text: 'YOUNGO’s main product. Regional consultations feed it.',
        },
      ],
    },
    {
      id: 'capacity',
      layout: 'prose',
      kicker: 'Knowledge and capacity building',
      title: 'Give the knowledge back',
      body: [
        'The Capacity Building Team exists so members can take part in decisions, not only receive updates.',
        'The 2026 ambition is to invite people from the working group into that team, continue the Just Transition Academy, and collaborate with other working groups and organisations. What it asks of you is creativity, initiative, and a willingness to make the work usable for someone else.',
      ],
    },
    {
      id: 'three-spaces',
      layout: 'split',
      kicker: 'Where the work sits',
      title: 'Three just-transition spaces',
      body: [
        'Response measures are the policies, programmes, and actions countries take to address climate change, and the socioeconomic impacts of those actions on workers, communities, industries, and trade. The group’s briefing splits the UNFCCC just-transition work into three spaces.',
      ],
      points: [
        {
          label: 'In a country',
          text: 'A coal phase-out changes local mining jobs.',
        },
        {
          label: 'Across borders',
          text: 'A carbon border measure such as CBAM changes exporters in other countries.',
        },
        {
          label: 'In a sector',
          text: 'A shift in agricultural subsidies changes farming livelihoods.',
        },
        {
          label: 'KCI — technical',
          text: 'The Katowice Committee of Experts, set up at COP24, studies what happens when climate policies land.',
        },
        {
          label: 'UAE JTWP — political',
          text: 'The UAE Just Transition Work Programme is where Parties negotiate and set norms.',
        },
        {
          label: 'Mechanism — implementation',
          text: 'The BAM space COP30 agreed to develop, being built toward COP31.',
        },
      ],
    },
    {
      id: 'watch',
      layout: 'rows',
      kicker: 'Response measures',
      title: 'What to keep watching at the KCI',
      body: [
        'The May 2026 briefing asks members to keep these items in view as the KCI works through its next workplan. Meetings are webcast. An in-person session needs a conference badge. Notes come back to the working group.',
      ],
      points: [
        {
          label: 'Co-chairs',
          text: 'Who chairs the KCI shapes the workplan.',
        },
        {
          label: 'Global Stocktake',
          text: 'The KCI prepares response-measures input for the stocktake. That is one way just transition shows up there.',
        },
        {
          label: 'Cross-border impacts',
          text: 'Measures such as CBAM, and their effects on developing countries, stay a live North–South question.',
        },
        {
          label: 'Local assessment tools',
          text: 'A toolbox for countries to assess impacts at home is a place to ask for youth-inclusive methods.',
        },
        {
          label: 'Case studies on decent work',
          text: 'Read whether youth employment and intergenerational questions are actually in the studies.',
        },
      ],
      links: [
        {
          label: 'KCI meetings',
          href: 'https://unfccc.int/KCI/meetings',
        },
        {
          label: 'KCI documents',
          href: 'https://unfccc.int/KCI/documents',
        },
      ],
    },
    {
      id: 'collaboration',
      layout: 'prose',
      kicker: 'Collaboration',
      title: 'Who the group works with',
      body: [
        'Cross-constituency work is part of the mandate. The onboarding names the Women and Gender Constituency, TUNGO, and CAN, plus UN agencies.',
        'Inside YOUNGO the regular counterparts are Energy, the Technology Mechanism, Finance and Markets, and Nature. NGO partners named by the group include Care About Climate and Indonesia Rangers.',
        'Joint work already on the 2026 record includes the mechanism submission with Technology and Finance and Markets, the Santa Marta fossil-fuel conference with Energy, and the deforestation roadmap submission with Nature and the Policy Team.',
      ],
    },
    {
      id: 'submissions',
      layout: 'rows',
      kicker: 'Policy work in 2026',
      title: 'Submissions on the year’s map',
      body: [
        'These are the filings and inputs the onboarding records for 2026. Treat them as the map of what the group has been working from, and ask the Policy Team before adding a new public line.',
      ],
      points: [
        {
          label: '15 February',
          text: 'Views on work to be undertaken, and possible topics for dialogues, under the UAE Just Transition Work Programme. Decision 3/CMA.5, paragraph 6.',
        },
        {
          label: '15 March',
          text: 'Views on the process for operationalising a just transition mechanism.',
        },
        {
          label: '31 March',
          text: 'COP30 Presidency roadmaps: transitioning away from fossil fuels in a just, orderly and equitable manner, and halting and reversing deforestation and forest degradation by 2030.',
        },
        {
          label: 'Global Youth Statement',
          text: 'Regional consultations are how this group informs the statement.',
        },
        {
          label: '30 April',
          text: 'Inputs for the first Artificial Intelligence dialogue.',
        },
        {
          label: 'May',
          text: 'Opportunities, best practices, actionable solutions, challenges, and barriers for the dialogue topics. Decision 3/CMA.5, paragraph 8.',
        },
      ],
    },
    {
      id: 'year',
      layout: 'months',
      kicker: '2026 timeline',
      title: 'The year the group planned',
      body: [
        'October through January is the stretch still in front of someone joining now: strategy, COP31, the debrief, and the next Contact Point selection. Earlier months are the path the group already set for 2026.',
      ],
      months: [
        {
          name: 'February',
          text: 'Submission on JTWP dialogue topics. Public hearing on the Belém mechanism.',
        },
        {
          name: 'March',
          text: 'Submission on mechanism operationalisation, with Technology and Finance and Markets. Deforestation and fossil-fuel roadmap submissions. Youth working group for the Santa Marta conference.',
        },
        {
          name: 'April',
          text: 'Checkpoint on food and energy security. Climate Week in the Republic of Korea and the fifth just-transition dialogue on food security. Conference on transitioning away from fossil fuels.',
        },
        {
          name: 'May',
          text: 'Submission on just-transition opportunities and barriers.',
        },
        {
          name: 'June',
          text: 'Road to COP31. Side event at SB64. SBSTA 64 agenda item 6 and SBI 64 agenda item 7.',
        },
        {
          name: 'July',
          text: 'Possible Just Transition Academy. Just-transition dialogue and the annual high-level ministerial round table.',
        },
        {
          name: 'August',
          text: 'Possible Just Transition Academy.',
        },
        {
          name: 'September',
          text: 'Follow-up checkpoint. Azerbaijan Climate Week.',
        },
        {
          name: 'October',
          ahead: true,
          text: 'Strategy reflection. Preparing COP31, cross-constituency work, and COY / Global Youth Statement.',
        },
        {
          name: 'November',
          ahead: true,
          text: 'COP31.',
        },
        {
          name: 'December',
          ahead: true,
          text: 'Debrief: what went well, what to improve, and the action items.',
        },
        {
          name: 'January',
          ahead: true,
          text: 'Next Contact Point selection and action planning for the following year.',
        },
      ],
    },
    {
      id: 'take-part',
      layout: 'cards',
      kicker: 'How to be an active member',
      title: 'Pick one team and stay close enough to reply',
      body: [
        'The journey the group describes runs from this onboarding, through the UNFCCC process, the YOUNGO process, and just-transition progress, into a sub-team task and then regional coordination.',
        'Calls for dialogues, conferences, and KCI meetings go out in the group channels. Names are shared there before a nomination is confirmed.',
      ],
      points: [
        {
          label: 'One sub-team or taskforce',
          text: 'That is where concrete work happens. Quality over quantity.',
        },
        {
          label: 'General Meetings',
          text: 'Sub-teams report, and the whole group hears the political moments.',
        },
        {
          label: 'Mailing list and WhatsApp',
          text: 'Check them often enough to reply or react, and leave threads you cannot follow.',
        },
      ],
    },
  ],
}

import { NDC_ONBOARDING_COURSE } from './ndcOnboardingCourse.js'

export const WG_SELF_PACED = {
  'just-transition': JT_ONBOARDING_COURSE,
  ndcs: NDC_ONBOARDING_COURSE,
}

export function getWgSelfPaced(slug) {
  return WG_SELF_PACED[slug] || null
}
