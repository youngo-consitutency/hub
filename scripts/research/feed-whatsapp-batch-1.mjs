/**
 * Feed high-priority items from completed Youngo Chats WhatsApp scans:
 * Nature's Echo, Finance & Markets, ACE Advocacy Network.
 *
 * Usage: node scripts/research/feed-whatsapp-batch-1.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FIXTURES = path.join(ROOT, 'data', 'fixtures.json')
const ACTIVITIES = path.join(ROOT, 'data', 'wg-activities.json')

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

const fixtures = readJson(FIXTURES, null)
if (!fixtures) {
  console.error('Missing fixtures.json')
  process.exit(1)
}
fixtures.opportunities = fixtures.opportunities || []
fixtures.events = fixtures.events || []
fixtures.submissions = fixtures.submissions || []
fixtures.announcements = fixtures.announcements || []

const summary = {}

const opportunities = [
  {
    slug: 'youngo-reform-teams-2026',
    kind: 'call',
    title: 'YOUNGO Reform Teams — expressions of interest',
    organizationName: 'YOUNGO GCT',
    summary:
      'Join Reform Teams to strengthen YOUNGO internal systems, governance, and operations (mandates, guidelines).',
    body: 'Shared via Nature WG WhatsApp 24 July 2026. Enquiries: cameron.smith@eyengineers.eu or gct-imt-group@googlegroups.com.',
    format: 'online',
    deadlineAt: '2026-07-27T23:59:00.000Z',
    linkUrl: 'https://forms.gle/D8EuPu8psbX4YkiVA',
    daysAgo: 3,
  },
  {
    slug: 'youngo-gsfp-election-eft-2026',
    kind: 'call',
    title: 'Volunteer — Global South FP Election Facilitation Team',
    organizationName: 'YOUNGO',
    summary:
      'Neutral volunteers needed for the Global South Focal Point election (Jul–Aug 2026). EFT members cannot run as candidates.',
    body: 'Shared via Nature WG WhatsApp 25 July 2026. Must stay reachable, confidential, and objective through the election period.',
    format: 'online',
    deadlineAt: '2026-07-30T23:59:00.000Z',
    linkUrl: 'https://forms.gle/cDozBaw8bUQhrAwW9',
    daysAgo: 2,
  },
  {
    slug: 'cohab3-conference-2026-abstracts',
    kind: 'call',
    title: 'Cohab3 — abstracts & side events (Health & Biodiversity)',
    organizationName: 'Cohab Initiative',
    summary:
      'Third International Conference on Health and Biodiversity — Galway, Ireland, 14–17 Sep 2026. Themes include climate–nature–food–water–health nexus.',
    body: 'Deadline extended to 12 August 2026. Shared via Nature WG WhatsApp 24 July 2026.',
    format: 'in_person',
    location: 'Galway, Ireland',
    region: 'Europe',
    deadlineAt: '2026-08-12T23:59:00.000Z',
    linkUrl: 'https://cohabinitiative.org/conference',
    daysAgo: 3,
  },
  {
    slug: 'lcoy-2026-speaker-database',
    kind: 'opportunity',
    title: 'LCOY 2026 Opportunities & Speaker Database',
    organizationName: 'YOUNGO LCOY Working Group',
    summary:
      'Register interest to be matched for LCOY/RCOY/GCOY panels, webinars, workshops, and partner events ahead of COP31.',
    body: 'Does not guarantee selection. Liaisons: Jeremy & Anirudh · lcoywg@gmail.com. Shared via Nature WG WhatsApp.',
    format: 'online',
    linkUrl:
      'https://docs.google.com/forms/d/e/1FAIpQLSe36c1SaZovXiyeOs48G9aVIjp-hEkK2xn8MvvPFv1OvkcY9g/viewform',
    daysAgo: 2,
  },
]

const events = [
  {
    slug: 'finance-wg-sb64-debrief-held',
    title: 'Finance WG — SB64 debrief & COP31 outlook (held)',
    type: 'wg_call',
    dayOffset: -23,
    hourUtc: 10,
    durationMin: 60,
    wg: 'finance',
    meetingUrl: 'https://meet.google.com/ksq-qcpj-gtb',
    description:
      'Held 4 July 2026, 10:00 UTC. Recapped SB64 finance outcomes and first COP31 prep. Calendar: https://calendar.app.google/yRqpJqLU1RXPCp3VA. Source: Finance & Markets WhatsApp.',
  },
]

const submissions = [
  {
    slug: 'finance-workplan-2026-inputs',
    title: 'Finance WG 2026 workplan — add your ideas',
    status: 'open',
    deadlineInDays: 21,
    wg: 'finance',
    draftUrl:
      'https://docs.google.com/document/d/1KveP7TnWO74Ceukxi-HDZZ1Vs6QSnV4jietTh2e89SA/edit?usp=sharing',
    contributeNote:
      'Comment in the shared Google Doc. 2025 workplan for context: https://docs.google.com/document/d/1olSn-AN8vfsRzuZxbxq1Xjrvb4TIIEMgZnmXv9frBFg/edit. Source: Finance WhatsApp (13 May 2026).',
  },
]

const announcements = [
  {
    slug: 'youngo-reform-teams-closing',
    title: 'YOUNGO Reform Teams EOI closes 27 July',
    body: 'Expressions of interest for YOUNGO Reform Teams close 27 July 2026, 23:59 UTC. Strengthen internal systems, governance, and operations.',
    pinned: true,
    daysAgo: 0,
    ctaUrl: 'https://forms.gle/D8EuPu8psbX4YkiVA',
    ctaLabel: 'Apply',
    ctaDeadlineAt: '2026-07-27T23:59:00.000Z',
  },
  {
    slug: 'youngo-gsfp-election-eft',
    title: 'Volunteers needed — Global South FP Election Facilitation Team',
    body: 'Neutral volunteers for the Global South Focal Point election (through Aug 2026). Deadline 30 July 2026, 23:59 UTC. EFT members cannot run as candidates.',
    pinned: false,
    daysAgo: 0,
    ctaUrl: 'https://forms.gle/cDozBaw8bUQhrAwW9',
    ctaLabel: 'Volunteer form',
    ctaDeadlineAt: '2026-07-30T23:59:00.000Z',
  },
  {
    slug: 'finance-membership-renewal-2026',
    title: 'Renew Finance & Markets WG membership',
    body: 'Confirm your 2026 Finance & Markets WG membership to stay on the roster and receive sub-group invites — even if you joined earlier via Airtable or WhatsApp.',
    pinned: false,
    daysAgo: 1,
    ctaUrl: 'https://forms.gle/2dM2Tm3bs9xgt5Rd6',
    ctaLabel: 'Membership form',
  },
  {
    slug: 'finance-sb64-turquoise-nexus-brief',
    title: 'Turquoise Nexus Initiative — YOUNGO views from SB64',
    body: 'Press release and SB64 workshop materials on means of implementation for youth and children — useful finance/MoI reference toward COP31.',
    pinned: false,
    daysAgo: 23,
    ctaUrl: 'https://enb.iisd.org/turquoise-nexus-initiative',
    ctaLabel: 'Read press release',
  },
]

for (const item of opportunities)
  summary[item.slug] = upsertBySlug(fixtures.opportunities, item)
for (const item of events)
  summary[item.slug] = upsertBySlug(fixtures.events, item)
for (const item of submissions)
  summary[item.slug] = upsertBySlug(fixtures.submissions, item)
for (const item of announcements)
  summary[item.slug] = upsertBySlug(fixtures.announcements, item)

const finance = fixtures.groups.find((g) => g.slug === 'finance')
if (finance) {
  upsertResource(finance, {
    label: '2026 membership renewal form',
    description: 'Confirm Finance & Markets WG membership for the 2026 term.',
    url: 'https://forms.gle/2dM2Tm3bs9xgt5Rd6',
  })
  upsertResource(finance, {
    label: 'MDB climate finance dashboard',
    description:
      'Multilateral development bank climate finance dashboard (ADB host).',
    url: 'https://data.adb.org/dashboard/mdb-climate-finance-dashboard',
  })
  upsertResource(finance, {
    label: '2026 workplan input doc',
    description:
      'Shared Google Doc to add ideas for the Finance & Markets 2026 workplan.',
    url: 'https://docs.google.com/document/d/1KveP7TnWO74Ceukxi-HDZZ1Vs6QSnV4jietTh2e89SA/edit?usp=sharing',
  })
  summary['finance.resources'] = 'updated'
}

const ace = fixtures.groups.find((g) => g.slug === 'ace')
if (ace) {
  upsertResource(ace, {
    label: 'Joint ACE Policy Paper (Mar 2026)',
    description:
      'Consolidated advocacy paper on GWP midterm review and ACE Action Plan (ACE Advocacy Network / YES Europe).',
    url: 'https://yeseurope.org/wp-content/uploads/2026/03/Joint-ACE-Policy-Paper-2nd-March-2026.pdf',
  })
  summary['ace.resources'] = 'updated'
}

const forum = fixtures.events.find((e) => e.slug === 'finance-wg-forum')
if (forum) {
  forum.meetingUrl = forum.meetingUrl || 'https://meet.google.com/ksq-qcpj-gtb'
  forum.description =
    'NCQG follow-up, SCF, funds, and markets. Latest shared Meet from the Jul 2026 SB64 debrief series: https://meet.google.com/ksq-qcpj-gtb. Join via Airtable, WhatsApp, or Linktree.'
  summary['finance-wg-forum'] = 'updated'
}

writeJson(FIXTURES, fixtures)

const activities = readJson(ACTIVITIES, [])
const wgActs = [
  {
    id: 'act-finance-membership-renewal',
    wg_slug: 'finance',
    kind: 'action_point',
    title: 'Renew Finance & Markets WG membership',
    body: 'Fill the 2026 membership form to stay on the roster and receive sub-group invites.',
    starts_at: null,
    ends_at: null,
    url: 'https://forms.gle/2dM2Tm3bs9xgt5Rd6',
    created_by: 'seed-whatsapp-finance',
    created_at: '2026-05-13T12:00:00.000Z',
  },
  {
    id: 'act-finance-workplan-inputs',
    wg_slug: 'finance',
    kind: 'submission',
    title: '2026 F&M workplan — add your ideas',
    body: 'Comment in the shared workplan Google Doc.',
    starts_at: null,
    ends_at: null,
    url: 'https://docs.google.com/document/d/1KveP7TnWO74Ceukxi-HDZZ1Vs6QSnV4jietTh2e89SA/edit?usp=sharing',
    created_by: 'seed-whatsapp-finance',
    created_at: '2026-05-13T12:00:00.000Z',
  },
  {
    id: 'act-finance-sb64-debrief',
    wg_slug: 'finance',
    kind: 'call',
    title: 'Finance WG SB64 debrief (4 July)',
    body: 'Held debrief on SB64 finance outcomes and COP31 outlook.',
    starts_at: '2026-07-04T10:00:00.000Z',
    ends_at: '2026-07-04T11:00:00.000Z',
    url: 'https://meet.google.com/ksq-qcpj-gtb',
    created_by: 'seed-whatsapp-finance',
    created_at: '2026-07-04T09:00:00.000Z',
  },
  {
    id: 'act-ace-joint-policy-paper-mar2026',
    wg_slug: 'ace',
    kind: 'submission',
    title: 'Joint ACE Policy Paper — GWP midterm review & ACE Action Plan',
    body: 'Consolidated advocacy paper from ACE Advocacy Network inputs (2 Mar 2026). Use for ongoing ACE Action Plan and post-SB64 advocacy.',
    starts_at: '2026-03-02T00:00:00.000Z',
    ends_at: null,
    url: 'https://yeseurope.org/wp-content/uploads/2026/03/Joint-ACE-Policy-Paper-2nd-March-2026.pdf',
    created_by: 'seed-whatsapp-ace-advocacy',
    created_at: '2026-03-02T12:00:00.000Z',
  },
]
for (const item of wgActs) summary[item.id] = upsertActivity(activities, item)
writeJson(ACTIVITIES, activities)

console.log(JSON.stringify({ ok: true, summary }, null, 2))
