/**
 * Feed curated ACE Telegram-export items into Hub surfaces.
 *
 * Routing:
 * - ACE-inherent work → fixtures events/submissions/announcements + wg-activities
 * - Non-ACE open calls / fellowships / speaker slots → fixtures.opportunities
 *   (member Opportunities board; also merges with NGO org postings)
 *
 * Usage:
 *   node scripts/research/feed-telegram-ace-to-hub.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const DATA = path.join(ROOT, 'data')
const FIXTURES = path.join(DATA, 'fixtures.json')
const ACTIVITIES = path.join(DATA, 'wg-activities.json')
const OPPORTUNITIES_FILE = path.join(DATA, 'ngo-opportunities.json')

const SEED_ACTOR = 'seed-org-ace-telegram-feed'

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

function removeSlugs(list, slugs) {
  const drop = new Set(slugs)
  const kept = list.filter((row) => !drop.has(row.slug))
  return { list: kept, removed: list.length - kept.length }
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

/** Non-ACE items previously parked on Home/submissions — move to Opportunities. */
const MOVE_OFF_ACE_SURFACES = {
  events: ['world-youth-skills-day-2026-webinar'],
  submissions: [
    'ccop-2026-applications',
    'gffb-campus-ambassador-2026',
    'youth-climate-leadership-speakers',
  ],
  announcements: [
    'ccop-2026-deadline',
    'gffb-campus-ambassador',
    'youth-climate-leadership-speakers-call',
  ],
}

/** Stale local NGO seed rows superseded by fixtures.opportunities. */
const DROP_SEEDED_OPP_IDS = [
  'opp-ccop-2026',
  'opp-gffb-campus-ambassador',
  'opp-youth-climate-leadership-speakers',
  'opp-mau-marathon-2026',
  'opp-iucn-youth-speaker',
  'opp-afs-youth-assembly-speaker',
]

const fixtureEvents = [
  {
    slug: 'ace-monthly-sb64-debrief-held',
    title: 'ACE WG monthly meeting & SB64 debrief (held)',
    type: 'wg_call',
    dayOffset: -30,
    hourUtc: 16,
    durationMin: 90,
    wg: 'ace',
    meetingUrl: 'https://meet.google.com/tjp-fcrx-vjt',
    description:
      'Held 27 June 2026, 16:00 UTC — ACE monthly meeting combined with SB64 debrief. Meet link retained for reference; watch the ACE channel for the next monthly call.',
  },
]

const fixtureSubmissions = [
  {
    slug: 'ace-cop31-day-concept-note',
    title: 'COP31 ACE Day — concept note inputs',
    status: 'open',
    deadlineInDays: 14,
    wg: 'ace',
    draftUrl:
      'https://docs.google.com/document/d/16DdBPgsdpmPPFW1-Nb0JfY6QhXe50pFVCYBrjeuCr7E/edit?usp=sharing',
    unfcccUrl: 'https://unfccc.int/topics/education-youth/ace',
    contributeNote:
      'ACE WG is drafting a COP31 ACE Day concept note at the request of the COP31 Presidencies. Add comments and inputs in the shared Google Doc.',
  },
  {
    slug: 'cop31-ace-side-event-merges',
    title: 'COP31 side-event merges — ACE, youth & disabilities',
    status: 'open',
    deadlineInDays: 30,
    wg: 'ace',
    draftUrl: 'https://unfccc.int/topics/education-youth/ace',
    contributeNote:
      'ACE WG call for accredited NGOs interested in official COP31 side-event merges on ACE, youth, and disabilities. Coordinate via ACE Contact Points.',
  },
]

const fixtureAnnouncements = [
  {
    slug: 'ace-cop31-day-inputs',
    title: 'COP31 ACE Day concept note — inputs welcome',
    body: 'The ACE Working Group is developing a COP31 ACE Day concept note following a request from the COP31 Presidencies. Comment in the shared Google Doc.',
    pinned: false,
    daysAgo: 0,
    ctaUrl:
      'https://docs.google.com/document/d/16DdBPgsdpmPPFW1-Nb0JfY6QhXe50pFVCYBrjeuCr7E/edit?usp=sharing',
    ctaLabel: 'Open concept note',
  },
  {
    slug: 'cop31-ace-side-event-partners',
    title: 'Seeking accredited NGOs for COP31 ACE side-event merges',
    body: 'ACE WG is looking for accredited NGOs interested in official COP31 side-event merges on ACE, youth, and disabilities. Reach out via ACE Contact Points if you are planning something similar.',
    pinned: false,
    daysAgo: 1,
  },
]

/** Shared Opportunities board — not ACE WG programme work. */
const fixtureOpportunities = [
  {
    slug: 'ccop-2026-applications',
    kind: 'opportunity',
    title: 'CCOP 2026 — call for applications',
    organizationName: 'CCOP',
    summary:
      'Applications open for CCOP 2026. Use the official site for the invitation-letter / application pathway.',
    body: 'Shared via constituency channels (ACE WG Telegram digest). Confirm deadline and eligibility on the official site before applying.',
    format: 'hybrid',
    deadlineInDays: 5,
    deadlineAt: '2026-08-01T23:59:00.000Z',
    linkUrl: 'https://www.ccopclimate.org/',
    daysAgo: 0,
  },
  {
    slug: 'gffb-campus-ambassador-2026',
    kind: 'opportunity',
    title: 'Campus Ambassador — Global Front For Biodiversity',
    organizationName: 'Global Front For Biodiversity',
    summary:
      'Join a global network of student changemakers focused on biodiversity, climate action, sustainability, and leadership.',
    body: 'Open call shared via constituency channels on 26 July 2026.',
    format: 'online',
    linkUrl: 'https://forms.gle/G3SPtpd367vn8Bsp6',
    daysAgo: 0,
  },
  {
    slug: 'youth-climate-leadership-speakers',
    kind: 'call',
    title: 'Call for speakers — Youth Climate Leadership',
    organizationName: 'Youth Climate Leadership',
    summary:
      'Speakers sought for the global virtual event “Youth Climate Leadership: Connecting Local Action to Global Change.”',
    body: 'Shared via constituency channels. Confirm whether the call remains open before applying.',
    format: 'online',
    linkUrl: 'https://forms.gle/qTh88xtS5yc2dgZs8',
    daysAgo: 1,
  },
  {
    slug: 'mau-marathon-2026',
    kind: 'event',
    title: 'Mau Marathon 2nd Edition — register',
    organizationName: 'Mau Marathon',
    summary:
      'Conservation and climate-action marathon protecting the Mau Forest Complex.',
    body: 'Registration form shared via constituency channels.',
    format: 'in_person',
    location: 'Mau Forest Complex, Kenya',
    region: 'Africa',
    linkUrl:
      'https://docs.google.com/forms/d/e/1FAIpQLSc6F24XOy8iq3cLN8N2OYyLNvFSPsQT1os_u_WW0KvJa-FuzQ/viewform?usp=header',
    daysAgo: 2,
  },
  {
    slug: 'world-youth-skills-day-2026-webinar',
    kind: 'workshop',
    title: 'World Youth Skills Day 2026 — Skills for a Shared Future',
    organizationName: 'World Youth Skills Day webinar',
    summary:
      'Webinar on skills for a shared future (AI, climate, digital transformation). Held 15 July 2026 — register link retained for late access.',
    body: 'Shared via constituency channels. Event date has passed; listing kept briefly for follow-up.',
    format: 'online',
    endsAt: '2026-07-16T00:00:00.000Z',
    linkUrl: 'https://us06web.zoom.us/meeting/register/Orc6gZKIRf6vvoF2Awm6xg',
    daysAgo: 12,
  },
  {
    slug: 'iucn-youth-speaker-2026',
    kind: 'call',
    title: 'YOUNGO speaker — IUCN Commission Membership webinar',
    organizationName: 'IUCN Youth Advisory Committee',
    summary:
      'YOUNGO speaker sought for “IUCN Commission Membership: youth in spotlight.”',
    body: 'Apply-by date in channels was 22 July 2026 — may be closed.',
    format: 'online',
    endsAt: '2026-07-22T23:59:00.000Z',
    deadlineAt: '2026-07-22T23:59:00.000Z',
    linkUrl: 'https://forms.gle/VFH1S1cuiH74Rskj6',
    daysAgo: 7,
  },
  {
    slug: 'afs-youth-assembly-speaker-2026',
    kind: 'call',
    title: 'YOUNGO speaker — AFS Youth Assembly International Youth Day',
    organizationName: 'AFS Youth Assembly',
    summary:
      'Tight-deadline call for a YOUNGO speaker at the AFS Youth Assembly International Youth Day high-level panel.',
    body: 'Shared 20 July 2026 — likely closed; retained for traceability.',
    format: 'hybrid',
    endsAt: '2026-07-22T23:59:00.000Z',
    deadlineAt: '2026-07-22T23:59:00.000Z',
    linkUrl: 'https://forms.gle/DYYL8HUJoHFohawe7',
    daysAgo: 7,
  },
]

const wgActivities = [
  {
    id: 'act-ace-cop31-day',
    wg_slug: 'ace',
    kind: 'submission',
    title: 'COP31 ACE Day — concept note inputs',
    body: 'Draft concept note for an ACE Day at COP31 (Presidency request). Add comments in the shared doc.',
    starts_at: null,
    ends_at: null,
    url: 'https://docs.google.com/document/d/16DdBPgsdpmPPFW1-Nb0JfY6QhXe50pFVCYBrjeuCr7E/edit?usp=sharing',
    created_by: SEED_ACTOR,
    created_at: '2026-06-29T14:35:58.000Z',
  },
  {
    id: 'act-ace-side-event-merges',
    wg_slug: 'ace',
    kind: 'action_point',
    title: 'COP31 side-event merges — find accredited NGO partners',
    body: 'Looking for accredited NGOs for official side-event merges on ACE, youth, and disabilities at COP31.',
    starts_at: null,
    ends_at: null,
    url: null,
    created_by: SEED_ACTOR,
    created_at: '2026-07-18T13:21:34.000Z',
  },
  {
    id: 'act-ace-monthly-sb64-debrief',
    wg_slug: 'ace',
    kind: 'call',
    title: 'ACE monthly meeting & SB64 debrief (27 June)',
    body: 'Monthly ACE WG meeting combined with SB64 debrief. Meet link retained for the series.',
    starts_at: '2026-06-27T16:00:00.000Z',
    ends_at: '2026-06-27T17:30:00.000Z',
    url: 'https://meet.google.com/tjp-fcrx-vjt',
    created_by: SEED_ACTOR,
    created_at: '2026-06-26T10:19:43.000Z',
  },
  {
    id: 'act-ace-gys-amplify',
    wg_slug: 'ace',
    kind: 'campaign',
    title: 'Amplify GYS 2026 call for inputs (deadline 31 July)',
    body: 'Global Youth Statement 2026 inputs are live — amplify in ACE channels. Official form: https://forms.gle/7Hw2ZQoxPvWzaotL9',
    starts_at: null,
    ends_at: '2026-07-31T23:59:00.000Z',
    url: 'https://forms.gle/7Hw2ZQoxPvWzaotL9',
    created_by: SEED_ACTOR,
    created_at: '2026-06-18T17:01:58.000Z',
  },
  {
    id: 'act-ace-annual-summary',
    wg_slug: 'ace',
    kind: 'submission',
    title: 'ACE annual summary inputs due 31 July',
    body: 'Coordinate non-Party inputs for the ACE annual summary after the SB64 Dialogue and Glasgow Work Programme midterm review.',
    starts_at: null,
    ends_at: '2026-07-31T23:59:00.000Z',
    url: 'https://www.unfccc.int/sites/default/files/resource/Info_session_ACE_SB64.pdf',
    created_by: SEED_ACTOR,
    created_at: '2026-07-01T12:00:00.000Z',
  },
]

const aceResources = [
  {
    label: 'COP31 ACE Day concept note',
    description:
      'Shared Google Doc for Presidency-requested ACE Day concept note inputs.',
    url: 'https://docs.google.com/document/d/16DdBPgsdpmPPFW1-Nb0JfY6QhXe50pFVCYBrjeuCr7E/edit?usp=sharing',
  },
  {
    label: 'ACE monthly Meet (latest shared)',
    description:
      'Google Meet used for the 27 June 2026 monthly meeting & SB64 debrief.',
    url: 'https://meet.google.com/tjp-fcrx-vjt',
  },
]

const summary = {
  fixtures: {},
  removed: {},
  opportunities: {},
  activities: {},
  cleanedSeedOpps: 0,
}

const fixtures = readJson(FIXTURES, null)
if (!fixtures) {
  console.error('Missing data/fixtures.json')
  process.exit(1)
}

fixtures.opportunities = Array.isArray(fixtures.opportunities)
  ? fixtures.opportunities
  : []

for (const [key, slugs] of Object.entries(MOVE_OFF_ACE_SURFACES)) {
  const result = removeSlugs(fixtures[key] || [], slugs)
  fixtures[key] = result.list
  if (result.removed) summary.removed[key] = result.removed
}

for (const event of fixtureEvents) {
  summary.fixtures[event.slug] = upsertBySlug(fixtures.events, event)
}
for (const submission of fixtureSubmissions) {
  summary.fixtures[submission.slug] = upsertBySlug(
    fixtures.submissions,
    submission,
  )
}
for (const announcement of fixtureAnnouncements) {
  summary.fixtures[announcement.slug] = upsertBySlug(
    fixtures.announcements,
    announcement,
  )
}
for (const opportunity of fixtureOpportunities) {
  summary.opportunities[opportunity.slug] = upsertBySlug(
    fixtures.opportunities,
    opportunity,
  )
}

const ace = fixtures.groups.find((g) => g.slug === 'ace')
if (ace) {
  ace.resources = ace.resources || []
  for (const resource of aceResources) {
    const idx = ace.resources.findIndex(
      (r) => r.url === resource.url || r.label === resource.label,
    )
    if (idx >= 0) ace.resources[idx] = { ...ace.resources[idx], ...resource }
    else ace.resources.push(resource)
  }
  summary.fixtures['ace.resources'] = 'updated'
}

const aceFollowUp = fixtures.events.find((e) => e.slug === 'ace-follow-up-call')
if (aceFollowUp) {
  aceFollowUp.meetingUrl =
    aceFollowUp.meetingUrl || 'https://meet.google.com/tjp-fcrx-vjt'
  summary.fixtures['ace-follow-up-call'] = 'updated'
}

writeJson(FIXTURES, fixtures)

// Drop superseded local NGO seed rows (board now reads fixtures.opportunities).
if (existsSync(OPPORTUNITIES_FILE)) {
  const opps = readJson(OPPORTUNITIES_FILE, [])
  const drop = new Set(DROP_SEEDED_OPP_IDS)
  const kept = opps.filter((row) => !drop.has(row.id))
  summary.cleanedSeedOpps = opps.length - kept.length
  writeJson(OPPORTUNITIES_FILE, kept)
}

const activities = readJson(ACTIVITIES, [])
for (const item of wgActivities) {
  summary.activities[item.id] = upsertActivity(activities, item)
}
writeJson(ACTIVITIES, activities)

console.log(JSON.stringify({ ok: true, summary }, null, 2))
console.log(`\nUpdated ${path.relative(ROOT, FIXTURES)}`)
console.log(
  `Opportunities board items: ${fixtures.opportunities.length} (fixtures.opportunities)`,
)
console.log(`ACE wg-activities: ${activities.length}`)
