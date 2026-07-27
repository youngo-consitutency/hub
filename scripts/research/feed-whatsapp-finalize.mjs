/**
 * Final careful routing pass for Youngo Chats → Hub.
 *
 * Rules:
 * - WG-inherent programme work → events / submissions / announcements / wg_activities / group resources
 * - Non-WG open calls → fixtures.opportunities
 * - Constituency-wide governance (Reform Teams, EFT) → opportunities (+ short Home pin if urgent)
 * - Already-fed GYS / Academy Session 2 → amplify only (no duplicate rows)
 *
 * Usage: node scripts/research/feed-whatsapp-finalize.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FIXTURES = path.join(ROOT, 'data', 'fixtures.json')
const ACTIVITIES = path.join(ROOT, 'data', 'wg-activities.json')
const PLAN = path.join(ROOT, 'data', 'research', 'youngo-chats-feed-plan.json')

function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    /* empty */
  }
  return fallback
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

function upsertBySlug(list, item) {
  const idx = list.findIndex((row) => row.slug === item.slug)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...item }
    return 'updated'
  }
  list.unshift(item)
  return 'added'
}

function upsertActivity(list, item) {
  const idx = list.findIndex(
    (row) =>
      row.id === item.id ||
      (row.wg_slug === item.wg_slug && row.title === item.title),
  )
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...item }
    return 'updated'
  }
  list.unshift(item)
  return 'added'
}

function upsertResource(group, resource) {
  group.resources = group.resources || []
  const idx = group.resources.findIndex(
    (r) => r.url === resource.url || r.label === resource.label,
  )
  if (idx >= 0) group.resources[idx] = { ...group.resources[idx], ...resource }
  else group.resources.push(resource)
}

function removeOppSlugs(list, slugs) {
  const drop = new Set(slugs)
  return list.filter((row) => !drop.has(row.slug))
}

const fixtures = readJson(FIXTURES, null)
if (!fixtures) {
  console.error('Missing fixtures.json')
  process.exit(1)
}

const summary = { moved: [], added: {}, updated: {} }

// --- Re-route: Adaptation CW4 is WG-inherent (not Opportunities board) ---
const beforeOpp = fixtures.opportunities.length
fixtures.opportunities = removeOppSlugs(fixtures.opportunities, [
  'adaptation-cw4-baku-2026',
])
if (fixtures.opportunities.length < beforeOpp) {
  summary.moved.push(
    'adaptation-cw4-baku-2026: opportunities → adaptation announcement + wg_activity only',
  )
}

// Ensure Adaptation has a proper open submission for CW4 (WG surface)
summary.added['adaptation-cw4-baku-nominations-submission'] = upsertBySlug(
  fixtures.submissions,
  {
    slug: 'adaptation-cw4-baku-nominations',
    title: 'Climate Week 4 (Baku) — Adaptation WG nominations',
    status: 'open',
    deadlineInDays: 0.5,
    wg: 'adaptation',
    draftUrl: 'https://forms.gle/Xr5PnNGSfYSwo5HB6',
    unfcccUrl: 'https://www.unfccc.int/climate-week-baku/events',
    contributeNote:
      'Adaptation WG invitation for 4 in-person + online youth reps to CW4 Baku (7–11 Sep 2026): Adaptation Roadmap Workshop and Adaptation Forum. Self-funded; hybrid. Deadline 27 July 2026, 23:59 UTC.',
  },
)

// --- Remaining medium-priority WG / constituency items ---
const opportunities = [
  {
    slug: 'one-seed-cop31-global-choir',
    kind: 'opportunity',
    title: 'One Seed — global choir for COP31',
    organizationName: 'One Seed',
    summary:
      'Low-friction cultural participation — join the global choir initiative toward COP31.',
    body: 'Shared via Road to COP31 Friends. Confirm details on LinkedIn.',
    format: 'online',
    linkUrl:
      'https://www.linkedin.com/posts/oneseed-cop31-globalchoir-share-7481149649043501056-sl73/',
    daysAgo: 14,
  },
  {
    slug: 'pacific-climate-leaders-opportunity-2026',
    kind: 'opportunity',
    title: 'Calling young Pacific climate leaders',
    organizationName: 'Pacific climate leadership call',
    summary:
      'Opportunity for young Pacific climate leaders (amplified by COP30/31 PYCC channels).',
    body: 'Shared via Road to COP31 Friends (12–13 Jul 2026). Confirm eligibility on the LinkedIn post.',
    format: 'hybrid',
    region: 'Pacific',
    linkUrl:
      'https://www.linkedin.com/posts/zoraya-el-raiss-cordero-6418bb75_calling-all-young-pacific-climate-leaders-share-7481904339008110592-r3NC/',
    daysAgo: 14,
  },
]

const announcements = [
  {
    slug: 'cop31-children-youth-pavilion-watch',
    title: 'Children & Youth Pavilion at COP31 — watch for confirmation',
    body: 'Road to COP31 Friends discussion indicates a Children & Youth Pavilion is expected again at COP31, but details are not yet confirmed. Watch YOUNGO / YCC channels.',
    pinned: false,
    daysAgo: 6,
  },
]

for (const item of opportunities) {
  summary.added[item.slug] = upsertBySlug(fixtures.opportunities, item)
}
for (const item of announcements) {
  summary.added[item.slug] = upsertBySlug(fixtures.announcements, item)
}

// --- Directory CP updates from WhatsApp (2026 confirmed in chat) ---
const dir = fixtures.directory
const financeContact = dir.find(
  (d) => d.group === 'wg_contacts' && d.wg === 'finance',
)
if (financeContact) {
  financeContact.description =
    '2026 Contact Points Marguerita Delgado and Tim (Finance Markets Bonn), per Finance & Markets WhatsApp. Join: membership form + Airtable + WhatsApp + Linktree · Instagram @youngo.climatefinance.'
  summary.updated['directory.finance'] = 'updated'
}

const adaptationContact = dir.find(
  (d) => d.group === 'wg_contacts' && d.wg === 'adaptation',
)
if (adaptationContact) {
  adaptationContact.description =
    '2026 Contact Points Gaël Bizet and Levina Oyugah (announced Mar 2026). Email adaptation.youngo@gmail.com. SB64 central doc and CW4 nomination form linked from the Adaptation WG page.'
  adaptationContact.publicEmail = 'adaptation.youngo@gmail.com'
  summary.updated['directory.adaptation'] = 'updated'
} else {
  dir.push({
    group: 'wg_contacts',
    roleTitle: 'Adaptation WG',
    wg: 'adaptation',
    description:
      '2026 Contact Points Gaël Bizet and Levina Oyugah. Email adaptation.youngo@gmail.com.',
    publicEmail: 'adaptation.youngo@gmail.com',
  })
  summary.added['directory.adaptation'] = 'added'
}

const genderContact = dir.find(
  (d) => d.group === 'wg_contacts' && d.wg === 'gender',
)
if (!genderContact) {
  dir.push({
    group: 'wg_contacts',
    roleTitle: 'Women and Gender WG',
    wg: 'gender',
    description:
      'Public WhatsApp invite on WG page. 2026 policy roadmap and onboarding deck linked from Gender WG resources.',
  })
  summary.added['directory.gender'] = 'added'
}

const aceContact = dir.find((d) => d.group === 'wg_contacts' && d.wg === 'ace')
if (aceContact) {
  aceContact.description =
    'Public entry: UNFCCC ACE pages, SB64 ACE Dialogue materials, Joint ACE Policy Paper, and COP31 ACE Day concept note. Current CP names not confirmed publicly for 2026.'
  summary.updated['directory.ace'] = 'updated'
}

// --- Group resources still missing ---
const nature = fixtures.groups.find((g) => g.slug === 'nature')
if (nature) {
  upsertResource(nature, {
    label: 'Task-force interest sheet (closed 20 Jul)',
    description:
      'Four task-force structure interest sheet for the 2026/27 Nature WG term.',
    url: 'https://docs.google.com/spreadsheets/d/1Q-G87MBnJZ7PBB3URlpxwsY1REs4kTOaGUEWP-bN4Sc/edit',
  })
  summary.updated['nature.resources'] = 'updated'
}

const finance = fixtures.groups.find((g) => g.slug === 'finance')
if (finance) {
  upsertResource(finance, {
    label: 'Turquoise Nexus Initiative (SB64)',
    description:
      'IISD ENB coverage of Turquoise Nexus / youth MoI materials from SB64.',
    url: 'https://enb.iisd.org/turquoise-nexus-initiative',
  })
  summary.updated['finance.resources'] = 'updated'
}

const agriculture = fixtures.groups.find((g) => g.slug === 'agriculture')
if (agriculture) {
  upsertResource(agriculture, {
    label: '2026 LCOY organizers sheet',
    description:
      'Approved 2026 LCOY organizers — use to embed food & agriculture agenda toward GYS.',
    url: 'https://docs.google.com/spreadsheets/d/1vwmkHG2isO5_7AwSPcml34UaZ_R3GdcowMpcw7IwG94/edit?gid=0#gid=0',
  })
  upsertResource(agriculture, {
    label: '2026 RCOY organizers sheet',
    description: 'Approved 2026 RCOY organizers by region.',
    url: 'https://docs.google.com/spreadsheets/d/11FKC7oeO91qN2THiQDY9QKALrwhQbO7_Pm0EVnRscmc/edit?gid=1780124112#gid=1780124112',
  })
  summary.updated['agriculture.resources'] = 'updated'
}

writeJson(FIXTURES, fixtures)

// --- Remaining wg_activities ---
const activities = readJson(ACTIVITIES, [])
const wgActs = [
  {
    id: 'act-finance-next-call-watch',
    wg_slug: 'finance',
    kind: 'call',
    title: 'Next Finance WG call — watch for date poll',
    body: 'After the 4 Jul SB64 debrief, CPs will poll for the next call. Watch WhatsApp / Linktree for the calendar invite. Last Meet: https://meet.google.com/ksq-qcpj-gtb',
    starts_at: null,
    ends_at: null,
    url: 'https://linktr.ee/finance_and_markets_wg_youngo',
    created_by: 'seed-whatsapp-finance',
    created_at: '2026-06-29T12:00:00.000Z',
  },
  {
    id: 'act-finance-newsletter-volunteer',
    wg_slug: 'finance',
    kind: 'action_point',
    title: 'Volunteer — quarterly Finance & Markets newsletter lead',
    body: 'Proposed at the 4 Jul SB64 debrief and endorsed by Tim (21 Jul). No draft yet — offer to lead via WG channels.',
    starts_at: null,
    ends_at: null,
    url: 'https://forms.gle/2dM2Tm3bs9xgt5Rd6',
    created_by: 'seed-whatsapp-finance',
    created_at: '2026-07-21T12:00:00.000Z',
  },
  {
    id: 'act-energy-lcer-2026-held',
    wg_slug: 'energy',
    kind: 'campaign',
    title: 'LCER 2026 London Clean Energy Roundtable (held)',
    body: 'Held 24–25 June 2026. Energy WG CP Saikat Das represented YOUNGO. Outcomes discussed at the 12 Jul bi-weekly call.',
    starts_at: '2026-06-24T00:00:00.000Z',
    ends_at: '2026-06-25T23:59:00.000Z',
    url: 'https://luma.com/kq2tryw0',
    created_by: 'seed-whatsapp-energy',
    created_at: '2026-06-24T12:00:00.000Z',
  },
  {
    id: 'act-adaptation-sb64-wa-channel',
    wg_slug: 'adaptation',
    kind: 'action_point',
    title: 'Join Adaptation SB64 / COP31 coordination WhatsApp',
    body: 'Operational channel for day-to-day adaptation negotiation coordination and intel sharing.',
    starts_at: null,
    ends_at: null,
    url: 'https://chat.whatsapp.com/G5aGCg0eIvL4MwOlwGLC8U',
    created_by: 'seed-whatsapp-adaptation',
    created_at: '2026-06-01T12:00:00.000Z',
  },
]

for (const item of wgActs) {
  summary.added[item.id] = upsertActivity(activities, item)
}
writeJson(ACTIVITIES, activities)

const plan = {
  scrapedAt: new Date().toISOString(),
  asOf: '2026-07-27',
  routingRules: [
    'WG-inherent → events / submissions / announcements / wg_activities / group.resources',
    'Non-WG open calls → fixtures.opportunities',
    'Constituency governance (Reform Teams, EFT) → opportunities (+ Home pin if urgent)',
    'GYS constituency form → amplify existing fixtures only',
    'Campaign chats (ICJAO/WYCJ) → opportunities + announcements, never wg_activities',
  ],
  chats: [
    {
      chat: 'ACE Advocacy Network',
      wg: 'ace',
      feed: ['Joint ACE Policy Paper → ace resources + wg_activities'],
      skip: ['expired surveys', 'DM-only volunteer calls'],
    },
    {
      chat: 'Adaptation WG',
      wg: 'adaptation',
      feed: [
        'CW4 Baku nominations → adaptation submission + announcement + wg_activity (NOT opportunities)',
        'SB64 central doc / WA channel / prep slides → resources + activities',
        'Belém Indicators webinar → events (from COP31 Friends)',
      ],
      skip: ['closed Belém Mission 1.5', 'past NAP Expo', 'GYS duplicate'],
    },
    {
      chat: 'Energy WG',
      wg: 'energy',
      feed: [
        'GYS consultation follow-up → update energy-gys-input-2026 + amplify activity',
        'COP-E + Virtual COP → wg_activities',
        'COY21 logo / NATO video / ENERGY2026 → opportunities',
        'LCER held → wg_activity archive',
      ],
      skip: ['closed SB64 badge/taskforce', 'GYS form duplicate'],
    },
    {
      chat: 'Finance & Markets WG',
      wg: 'finance',
      feed: [
        'Membership renewal + workplan → resources + announcements + submissions + activities',
        'SB64 debrief held → events + activities',
        'Turquoise Nexus / MDB dashboard → resources + announcement',
      ],
      skip: ['spam trainings', 'expired SB64 prep', 'wrong-WG forwards'],
    },
    {
      chat: 'Women and Gender WG',
      wg: 'gender',
      feed: [
        'GYS gender amplify + CSW71 + SRHR sign-on → wg_activities / submissions',
        'Roadmap + onboarding → gender resources',
        'APYCD / AU badges / travel → opportunities',
      ],
      skip: ['harassment thread (never public)', 'expired YOUNGO-wide spam'],
    },
    {
      chat: 'Food & Agriculture WG',
      wg: 'agriculture',
      feed: [
        'F&A GYS draft (29 Jul) → submissions + activities',
        'Consultations #1–#3 → events',
        'LCOY/RCOY food campaign → activities + resources',
      ],
      skip: ['Academy Session 2 already in Hub', 'closed external SB64 slots'],
    },
    {
      chat: "Nature's Echo",
      wg: 'nature',
      feed: [
        'Reform Teams / EFT / Cohab3 / LCOY speakers → opportunities (forwarded, not Nature-owned)',
        'Task-force sheet → nature resource',
      ],
      skip: ['GFFB/IUCN/AFS already fed', 'kickoff already in Hub'],
    },
    {
      chat: 'Road to COP31 Friends',
      wg: null,
      feed: [
        'Belém webinar → events',
        'ICPAC / CSET / Glacier / NYC CW / AU pathways / Benin → opportunities',
        'Volunteer video + YCC programmes + Pavilion watch → announcements',
        'GYS / COP31 partnerships / volunteers → amplify existing',
      ],
      skip: ['join spam', 'closed COY/LCOY EOIs', 'scam posts'],
    },
    {
      chat: 'ICJAO / WYCJ campaign',
      wg: null,
      feed: [
        'Action-versary festival / video / toolkit → opportunities',
        'Action-versary hub → announcements',
      ],
      skip: [
        'past UNGA vote blitz',
        'expired trainings',
        'wg_activities (not a Hub WG)',
      ],
    },
  ],
  countsAfter: {
    opportunities: fixtures.opportunities.length,
    events: fixtures.events.length,
    submissions: fixtures.submissions.length,
    announcements: fixtures.announcements.length,
    wgActivities: activities.length,
  },
  summary,
}

writeJson(PLAN, plan)
console.log(JSON.stringify(plan.summary, null, 2))
console.log('counts', plan.countsAfter)
console.log('Wrote', path.relative(ROOT, PLAN))
