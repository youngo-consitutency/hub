/**
 * Feed remaining Youngo Chats WhatsApp scans:
 * Agriculture, Gender, Adaptation, Energy, Road to COP31 Friends, ICJAO/WYCJ.
 *
 * Usage: node scripts/research/feed-whatsapp-batch-2.mjs
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
for (const key of ['opportunities', 'events', 'submissions', 'announcements']) {
  fixtures[key] = fixtures[key] || []
}

const summary = {}

const opportunities = [
  {
    slug: 'adaptation-cw4-baku-2026',
    kind: 'opportunity',
    title: 'Climate Week 4 — Baku Adaptation nominations',
    organizationName: 'YOUNGO Adaptation WG / UNFCCC',
    summary:
      'Nominate for CW4 adaptation mandated events in Baku (7–11 Sep 2026): Adaptation Roadmap Workshop and Adaptation Forum. Self-funded; hybrid format.',
    body: 'Adaptation WG invitation for 4 in-person + online youth reps. Apply by 27 July 2026, 23:59 UTC. Source: Adaptation WhatsApp.',
    format: 'hybrid',
    location: 'Baku, Azerbaijan',
    region: 'Asia',
    deadlineAt: '2026-07-27T23:59:00.000Z',
    endsAt: '2026-09-11T23:59:00.000Z',
    linkUrl: 'https://forms.gle/Xr5PnNGSfYSwo5HB6',
    daysAgo: 4,
  },
  {
    slug: 'coy21-logo-design-2026',
    kind: 'call',
    title: 'COY21 logo design call',
    organizationName: 'YOUNGO / COY21',
    summary: 'Global call for COY21 Antalya logo designs from youth creatives.',
    body: 'Shared via Energy and Gender WG channels. Deadline 31 July 2026.',
    format: 'online',
    deadlineAt: '2026-07-31T23:59:00.000Z',
    linkUrl: 'https://forms.gle/CSpp1owuqt32xavZ6',
    daysAgo: 10,
  },
  {
    slug: 'pre-cop31-apycd-fiji-2026',
    kind: 'opportunity',
    title: 'Pre-COP31 Australia & Pacific Youth Climate Dialogue (APYCD)',
    organizationName: 'UNICEF Pacific Islands',
    summary:
      'Fiji dialogue (Oct 2026) for young climate leaders aged 14–29 from Australia, Pacific, and NZ ahead of Pacific Pre-COP and COP31.',
    body: 'Shared in Gender WG 15 Jul 2026. Confirm eligibility on the official UNICEF page.',
    format: 'in_person',
    location: 'Fiji',
    region: 'Pacific',
    linkUrl: 'https://www.unicef.org/pacificislands/call-applications-apycd',
    daysAgo: 12,
  },
  {
    slug: 'cop31-aus-overflow-badges-2026',
    kind: 'opportunity',
    title: 'COP31 — Australian Party overflow badge applications',
    organizationName: 'Australian Government (DCCEEW)',
    summary:
      'Overflow badge pathway for COP31 accreditation via the Australian Party process.',
    body: 'Shared by Gender WG CP 7 Jul 2026. Confirm nationality/residency rules on the official portal.',
    format: 'in_person',
    deadlineAt: '2026-08-13T23:59:00.000Z',
    linkUrl:
      'https://unfccc-cop.dcceew.gov.au/cop31-australian-party-overflow-badge-applications',
    daysAgo: 20,
  },
  {
    slug: 'cop31-aus-travel-support-2026',
    kind: 'opportunity',
    title: 'COP31 Climate Conference Travel Support (Australia-registered)',
    organizationName: 'Australian Government',
    summary:
      'AUD 15–20k travel support grants for COP31 — Australia residency required.',
    body: 'Shared via Gender WG WhatsApp. Confirm eligibility on grants.gov.au.',
    format: 'in_person',
    region: 'Pacific',
    linkUrl:
      'https://www.grants.gov.au/Go/Show?GoUuid=92D60D01-4B15-445B-877C-99BD756C239A',
    daysAgo: 20,
  },
  {
    slug: 'icpac-care-about-climate-2026',
    kind: 'training',
    title: 'International Climate Policy and Advocacy Course (ICPAC)',
    organizationName: 'Care About Climate',
    summary:
      '8 self-paced modules + live sessions. Available in 7 languages including Turkish. Scholarship option. Does not provide COP accreditation.',
    body: 'Shared via Road to COP31 Friends (17 Jul 2026).',
    format: 'online',
    linkUrl: 'https://www.careaboutclimate.org/climate-policy-and-advocacy',
    daysAgo: 10,
  },
  {
    slug: 'cset-youth-global-exco-2026',
    kind: 'opportunity',
    title: 'CSET Youth Global ExCo 2026–2027',
    organizationName: 'CSET Youth',
    summary:
      'Commonwealth energy-youth leadership roles (Global Lead, Community, Capacity Building, Policy). Ages 18–29; ~5–10 h/week.',
    body: 'Shared via Road to COP31 Friends (15 Jul 2026). Confirm application path on LinkedIn.',
    format: 'online',
    linkUrl: 'https://www.linkedin.com/company/csetyouth/',
    daysAgo: 12,
  },
  {
    slug: 'glacier-nation-global-challenge-2026',
    kind: 'opportunity',
    title: 'Glacier Nation Global Challenge 2026',
    organizationName: 'Glacier Nation',
    summary:
      'Cryosphere / high-mountain youth challenge. Registration window referenced as 27 July 2026.',
    body: 'Broadcast via Road to COP31 Friends (21 Jul 2026). Confirm status on Mailchimp link.',
    format: 'online',
    deadlineAt: '2026-07-27T23:59:00.000Z',
    linkUrl: 'https://mailchi.mp/a16eaccb82e4/registro-global-challenge-2026',
    daysAgo: 6,
  },
  {
    slug: 'nyc-climate-week-2026-submit-events',
    kind: 'opportunity',
    title: 'NYC Climate Week — submit events (pay-what-you-can)',
    organizationName: 'Climate Week NYC',
    summary:
      'Submit events before fees jump — $0 tier referenced before 7 August 2026.',
    body: 'Shared via Road to COP31 Friends (15 Jul 2026). Confirm on the Climate Week NYC portal.',
    format: 'in_person',
    location: 'New York, USA',
    region: 'North America',
    deadlineAt: '2026-08-07T23:59:00.000Z',
    linkUrl: 'https://www.climateweeknyc.org/',
    daysAgo: 12,
  },
  {
    slug: 'australia-cop31-involvement-2026',
    kind: 'opportunity',
    title: 'Australia — new ways to get involved at COP31',
    organizationName: 'Australian Government (DCCEEW)',
    summary: 'Official Australian Government pathways to engage at COP31.',
    body: 'Shared via Road to COP31 Friends. Also see AU overflow badges and travel support listings.',
    format: 'hybrid',
    region: 'Pacific',
    linkUrl:
      'https://www.dcceew.gov.au/about/news/applications-open-new-ways-get-involved-cop31',
    daysAgo: 12,
  },
  {
    slug: 'connected-advocacy-localization-benin-2026',
    kind: 'opportunity',
    title: 'Global Localization Forum — Benin (road to COP31)',
    organizationName: 'Connected Advocacy',
    summary:
      'Africa localization dialogue framed as a road-to-COP31 process (5–7 Aug 2026).',
    body: 'Shared via Road to COP31 Friends.',
    format: 'in_person',
    location: 'Benin',
    region: 'Africa',
    deadlineAt: '2026-08-05T23:59:00.000Z',
    linkUrl:
      'https://docs.google.com/forms/d/e/1FAIpQLScycmFoL-64HuFwT8R3X0zzLpWbb7eB7Vnvl5WNeT1f3V8RXA/viewform',
    daysAgo: 10,
  },
  {
    slug: 'nato-ensec-youth-video-2026',
    kind: 'call',
    title: 'NATO ENSEC COE — youth video competition',
    organizationName: 'NATO ENSEC COE',
    summary:
      'Youth video competition on energy security / blackout resilience themes.',
    body: 'Shared via Energy WG WhatsApp. Deadline 31 July 2026.',
    format: 'online',
    deadlineAt: '2026-07-31T23:59:00.000Z',
    linkUrl: 'https://www.enseccoe.org/projects/youth-video-competition/',
    daysAgo: 10,
  },
  {
    slug: 'energy2026-global-conference',
    kind: 'event',
    title: 'ENERGY2026 — 8th Global Energy Conference',
    organizationName: 'ENERGY Conference',
    summary: 'Free virtual global energy conference, 6–7 October 2026.',
    body: 'Shared via Energy WG WhatsApp.',
    format: 'online',
    startsAt: '2026-10-06T00:00:00.000Z',
    endsAt: '2026-10-07T23:59:00.000Z',
    linkUrl:
      'https://live.letsgetdigital.com/5267-energy_2026/virtualevent/registered',
    daysAgo: 14,
  },
  {
    slug: 'wycj-icjao-actionversary-festival-2026',
    kind: 'opportunity',
    title: 'ICJ AO Action-versary — join the Global Festival',
    organizationName: 'World Youth for Climate Justice (WYCJ)',
    summary:
      'Mark one year since the ICJ climate advisory opinion: register your org’s anniversary action or sign up as a Festival Partner.',
    body: 'Shared via WYCJ / ICJAO campaign channel. Forms remain useful for COP31 implementation storytelling.',
    format: 'online',
    linkUrl:
      'https://docs.google.com/forms/d/1ZNf9wswKG-UEhOvAg_CoSH2qP4D7ri-tkoDUHC0KHTo/edit',
    daysAgo: 12,
  },
  {
    slug: 'wycj-icjao-video-campaign-2026',
    kind: 'call',
    title: 'ICJ AO anniversary — submit a short video clip',
    organizationName: 'World Youth for Climate Justice (WYCJ)',
    summary:
      'Film a personal clip on how the ICJ advisory opinion is shaping your climate advocacy, litigation, or policy work.',
    body: 'Instructions at wy4cj.org/icj-aonniversary. Submit to doga@wy4cj.org and quint@wy4cj.org.',
    format: 'online',
    linkUrl: 'https://www.wy4cj.org/icj-aonniversary',
    daysAgo: 12,
  },
  {
    slug: 'wycj-icjao-implementation-toolkit-2026',
    kind: 'call',
    title: 'Contribute to the Global ICJ AO Implementation Toolkit',
    organizationName: 'World Youth for Climate Justice (WYCJ)',
    summary:
      'Share AO-related resources for a crowdsourced implementation hub.',
    body: 'Email resources to nicole@wy4cj.org. Campaign channel, 15 Jul 2026.',
    format: 'online',
    linkUrl: 'https://www.wy4cj.org/icj-aonniversary',
    daysAgo: 12,
  },
]

const events = [
  {
    slug: 'belem-adaptation-indicators-webinar-jul29',
    title: 'Testing Belém Adaptation Indicators — global webinar',
    type: 'webinar',
    dayOffset: 2,
    hourUtc: 12,
    durationMin: 90,
    wg: 'adaptation',
    meetingUrl:
      'https://events.teams.microsoft.com/event/cda64415-9206-4ce9-bf6a-807726cf1867@1cc3c508-01c7-4460-bd2b-afe95e80b8af',
    description:
      'COP30/COP31 Presidencies webinar on piloting Belém Adaptation Indicators for NAPs, BTRs, and adaptation finance. 29 July 2026, 14:00 CEST. Source: Road to COP31 Friends / PYCC.',
  },
  {
    slug: 'agriculture-gys-consultation-1-held',
    title: 'Food & Agriculture WG — GYS Consultation #1 (held)',
    type: 'wg_call',
    dayOffset: -2,
    hourUtc: 15,
    durationMin: 90,
    wg: 'agriculture',
    meetingUrl: 'https://meet.google.com/vjq-wxhd-pns',
    description:
      'Held 25 July 2026, 15:00–16:30 UTC. Written inputs to the F&A GYS draft close 29 July — use Suggestion mode in the shared doc.',
  },
  {
    slug: 'agriculture-gys-consultation-2',
    title: 'Food & Agriculture WG — GYS Consultation #2',
    type: 'wg_call',
    dayOffset: 19,
    hourUtc: 9,
    durationMin: 90,
    wg: 'agriculture',
    description:
      'Second F&A GYS consultation — Saturday 15 August 2026, 11:00 CEST. Calendar invite to be shared in WG channels.',
  },
  {
    slug: 'agriculture-gys-consultation-3',
    title: 'Food & Agriculture WG — GYS Consultation #3',
    type: 'wg_call',
    dayOffset: 51,
    hourUtc: 16,
    durationMin: 90,
    wg: 'agriculture',
    description:
      'Third F&A GYS consultation — Wednesday 16 September 2026, 18:00 CEST. Multilingual sessions promised later.',
  },
  {
    slug: 'agriculture-july-wg-sb64-debrief-held',
    title: 'Food & Agriculture WG — July call & SB64 debrief (held)',
    type: 'wg_call',
    dayOffset: -10,
    hourUtc: 14,
    durationMin: 90,
    wg: 'agriculture',
    meetingUrl: 'https://meet.google.com/trt-hpqi-yia',
    description:
      'Held 17 July 2026. SB64 outcomes, Academy, and GYS next steps. Slides: https://docs.google.com/presentation/d/1JjiZ-UAH7wX4eJcqyUANoSlmNlFHuiFI/edit',
  },
]

const submissions = [
  {
    slug: 'agriculture-gys-2026-draft-inputs',
    title: 'Food & Agriculture WG — GYS 2026 draft inputs',
    status: 'open',
    deadlineInDays: 2,
    wg: 'agriculture',
    draftUrl:
      'https://docs.google.com/document/d/1hZRlinZEsJavOX7X9yFH0ZgI0JmPnCwB/edit?usp=sharing',
    contributeNote:
      'Add food-systems and COP31 negotiation inputs in Suggestion mode by 29 July 2026. Align with the constituency GYS form (deadline 31 July 2026, 23:59 UTC).',
  },
  {
    slug: 'gender-csw71-youth-feminists',
    title: 'CSW71 — young feminist community consultation representatives',
    status: 'open',
    deadlineInDays: 45,
    wg: 'gender',
    draftUrl: 'https://forms.gle/8DBtc3Yi8VKfuozA9',
    contributeNote:
      'UN Women youth-feminist prep: young people under 35 connected to orgs/movements can apply to organize community consultations for CSW71. Source: Gender WG WhatsApp.',
  },
]

const announcements = [
  {
    slug: 'adaptation-cw4-baku-nominations',
    title: 'Adaptation WG — Climate Week 4 (Baku) nominations close 27 July',
    body: 'Apply for YOUNGO Adaptation nominations to CW4 Baku adaptation events (7–11 Sep). Self-funded; hybrid format. Deadline 27 July 2026, 23:59 UTC.',
    pinned: true,
    daysAgo: 0,
    ctaUrl: 'https://forms.gle/Xr5PnNGSfYSwo5HB6',
    ctaLabel: 'Apply',
    ctaDeadlineAt: '2026-07-27T23:59:00.000Z',
  },
  {
    slug: 'agriculture-gys-draft-deadline',
    title: 'F&A GYS draft inputs due 29 July',
    body: 'Food & Agriculture WG members: add comments in Suggestion mode to the shared GYS draft by 29 July, then submit via the official GYS form by 31 July.',
    pinned: false,
    daysAgo: 0,
    ctaUrl:
      'https://docs.google.com/document/d/1hZRlinZEsJavOX7X9yFH0ZgI0JmPnCwB/edit?usp=sharing',
    ctaLabel: 'Open draft',
    ctaDeadlineAt: '2026-07-29T23:59:00.000Z',
  },
  {
    slug: 'cop31-volunteer-video-aug2',
    title: 'COP31 volunteer programme — video interview step due 2 August',
    body: 'Volunteer applications for Antalya (9–20 Nov) remain open through August. Recent applicants report a ~3-minute video interview step — check Presidency Instagram guidance (due 2 August).',
    pinned: false,
    daysAgo: 0,
    ctaUrl: 'https://cop31volunteers.com',
    ctaLabel: 'Volunteer site',
    ctaDeadlineAt: '2026-08-02T23:59:00.000Z',
  },
  {
    slug: 'ycc-cop31-antalya-programmes',
    title: 'Youth Climate Collaborative COP31 programmes — Antalya',
    body: 'YCC is preparing Media Training (8 Nov), Field Trip (15 Nov), and Youth Gala (17 Nov). Seeking Antalya venue partners and local connectors.',
    pinned: false,
    daysAgo: 10,
    ctaUrl: 'https://chat.whatsapp.com/BYeHHdJe1xt3o0YOu7cCJA',
    ctaLabel: 'YCC COP WhatsApp',
  },
  {
    slug: 'wycj-icjao-actionversary-2026',
    title: 'ICJ advisory opinion — one year on: join WYCJ Action-versary',
    body: 'WYCJ is running a Global Action-versary (webinars, video campaign, implementation toolkit) through COP31. Register actions and submit clips via wy4cj.org.',
    pinned: false,
    daysAgo: 4,
    ctaUrl: 'https://www.wy4cj.org/icj-actionversary',
    ctaLabel: 'Action-versary hub',
  },
  {
    slug: 'belem-adaptation-indicators-webinar',
    title: 'Belém Adaptation Indicators webinar — 29 July',
    body: 'COP30/COP31 Presidencies host a global webinar on piloting Belém Adaptation Indicators (29 July, 14:00 CEST).',
    pinned: false,
    daysAgo: 0,
    ctaUrl:
      'https://events.teams.microsoft.com/event/cda64415-9206-4ce9-bf6a-807726cf1867@1cc3c508-01c7-4460-bd2b-afe95e80b8af',
    ctaLabel: 'Register / join',
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

// Refresh Energy GYS submission
const energyGys = fixtures.submissions.find(
  (s) => s.slug === 'energy-gys-input-2026',
)
if (energyGys) {
  energyGys.status = 'open'
  energyGys.deadlineInDays = 4.2
  energyGys.draftUrl = 'https://forms.gle/7Hw2ZQoxPvWzaotL9'
  energyGys.contributeNote =
    'Open consultation held 26 July 13:30 UTC (CPs Saikat Das, Dimple Asopa). Submit written energy-policy inputs via the official GYS form before 31 July; watch Energy WG LinkedIn/IG for WG-specific draft/minutes.'
  summary['energy-gys-input-2026'] = 'updated'
}

// Enrich existing COP31 volunteer announcement if present
const volunteerAnn = fixtures.announcements.find(
  (a) => a.slug === 'cop31-volunteers-open',
)
if (volunteerAnn) {
  volunteerAnn.body =
    'Applications for the COP31 volunteer programme in Antalya (9–20 November 2026) remain open through August. More than 10,000 people from 104 countries have already applied — details at cop31volunteers.com. Recent applicants report a video interview step due around 2 August.'
  volunteerAnn.ctaUrl = volunteerAnn.ctaUrl || 'https://cop31volunteers.com'
  volunteerAnn.ctaLabel = volunteerAnn.ctaLabel || 'Volunteer site'
  summary['cop31-volunteers-open'] = 'updated'
}

const agriculture = fixtures.groups.find((g) => g.slug === 'agriculture')
if (agriculture) {
  upsertResource(agriculture, {
    label: 'GYS 2026 F&A draft inputs',
    description:
      'Shared Google Doc for Food & Agriculture GYS thematic inputs (Suggestion mode).',
    url: 'https://docs.google.com/document/d/1hZRlinZEsJavOX7X9yFH0ZgI0JmPnCwB/edit?usp=sharing',
  })
  summary['agriculture.resources'] = 'updated'
}

const gender = fixtures.groups.find((g) => g.slug === 'gender')
if (gender) {
  upsertResource(gender, {
    label: '2026 policy & submissions roadmap',
    description:
      'CP-maintained Gender WG plan for 2026 submissions and processes.',
    url: 'https://docs.google.com/document/d/14x8deg6vEu1oKLfWP_EzBtMqPFVGPNNePP9T4-EzE3E/edit',
  })
  upsertResource(gender, {
    label: 'Gender WG onboarding deck',
    description: 'Onboarding slides for Women and Gender WG members.',
    url: 'https://docs.google.com/presentation/d/1mqEYj6iIxXiQbXBReaEk5M78SdRdL_BRW3Ps_Bb6hYk/edit',
  })
  upsertResource(gender, {
    label: 'Gender WG resource bank',
    description: 'Shared databank document for Gender WG members.',
    url: 'https://docs.google.com/document/d/1NGyhHF2ppqrxG7y7aFLRtDxSHbD5a4th5_0YnxUA3Lc/edit',
  })
  summary['gender.resources'] = 'updated'
}

const adaptation = fixtures.groups.find((g) => g.slug === 'adaptation')
if (adaptation) {
  upsertResource(adaptation, {
    label: 'SB64 Adaptation central working document',
    description:
      'Positions, negotiation notes, resources, and role coordination hub.',
    url: 'https://docs.google.com/document/d/1-pHu4hLJV1ohRWDfkDqYPAmJYDlq3luAA-ljy20x02w/edit',
  })
  upsertResource(adaptation, {
    label: 'SB64 Adaptation coordination WhatsApp',
    description: 'Day-to-day adaptation negotiation coordination channel.',
    url: 'https://chat.whatsapp.com/G5aGCg0eIvL4MwOlwGLC8U',
  })
  upsertResource(adaptation, {
    label: 'SB64 prep slides (archive)',
    description:
      'Adaptation WG SB64 preparation slides and capacity-building archive.',
    url: 'https://docs.google.com/presentation/d/11DJ1ZhxH3qcDza4UhmIfTNZpbssKshWf8yeMCIruzRM/edit',
  })
  summary['adaptation.resources'] = 'updated'
}

const energy = fixtures.groups.find((g) => g.slug === 'energy')
if (energy) {
  upsertResource(energy, {
    label: 'Energy WG bi-weekly calendar',
    description: 'Google Calendar link for Energy WG bi-weekly calls.',
    url: 'https://calendar.app.google/jgZPg5Qf8RTjdyiy8',
  })
  summary['energy.resources'] = 'updated'
}

const adaptationCall = fixtures.events.find((e) => e.slug === 'adaptation-call')
if (adaptationCall) {
  adaptationCall.description = `${adaptationCall.description} Climate Week 4 (Baku) nominations form: https://forms.gle/Xr5PnNGSfYSwo5HB6 (deadline 27 July 2026).`
  summary['adaptation-call'] = 'updated'
}

writeJson(FIXTURES, fixtures)

const activities = readJson(ACTIVITIES, [])
const wgActs = [
  {
    id: 'act-agriculture-gys-draft-inputs',
    wg_slug: 'agriculture',
    kind: 'submission',
    title: 'GYS 2026 — add F&A inputs to open draft',
    body: 'Add comments in Suggestion mode and sign the contributor section. Draft closes 29 July; official GYS form closes 31 July.',
    starts_at: null,
    ends_at: '2026-07-29T23:59:00.000Z',
    url: 'https://docs.google.com/document/d/1hZRlinZEsJavOX7X9yFH0ZgI0JmPnCwB/edit?usp=sharing',
    created_by: 'seed-whatsapp-agriculture',
    created_at: '2026-07-25T15:00:00.000Z',
  },
  {
    id: 'act-agriculture-lcoy-rcoy-gys',
    wg_slug: 'agriculture',
    kind: 'campaign',
    title: 'Embed food & agriculture in LCOY/RCOY → GYS',
    body: 'Contact approved 2026 LCOY/RCOY organizers in your country or region to strengthen the food and agriculture agenda before GYS.',
    starts_at: null,
    ends_at: '2026-07-31T23:59:00.000Z',
    url: 'https://docs.google.com/spreadsheets/d/1vwmkHG2isO5_7AwSPcml34UaZ_R3GdcowMpcw7IwG94/edit?gid=0#gid=0',
    created_by: 'seed-whatsapp-agriculture',
    created_at: '2026-07-20T13:26:01.000Z',
  },
  {
    id: 'act-gender-gys-amplify-2026',
    wg_slug: 'gender',
    kind: 'campaign',
    title: 'Amplify GYS 2026 — centre gender justice in COP31 youth demands',
    body: 'Gender WG members: submit intersectional gender, SRHR, and GBV-climate demands via the official GYS form before 31 July.',
    starts_at: '2026-06-17T00:00:00.000Z',
    ends_at: '2026-07-31T23:59:00.000Z',
    url: 'https://forms.gle/7Hw2ZQoxPvWzaotL9',
    created_by: 'seed-whatsapp-gender',
    created_at: '2026-06-17T12:00:00.000Z',
  },
  {
    id: 'act-gender-csw71-youth-feminists',
    wg_slug: 'gender',
    kind: 'action_point',
    title: 'CSW71 — young feminist community consultation representatives',
    body: 'Apply to organize community consultations and bring youth priorities into CSW71.',
    starts_at: null,
    ends_at: null,
    url: 'https://forms.gle/8DBtc3Yi8VKfuozA9',
    created_by: 'seed-whatsapp-gender',
    created_at: '2026-06-05T16:13:03.000Z',
  },
  {
    id: 'act-gender-srhr-un80-signon',
    wg_slug: 'gender',
    kind: 'campaign',
    title: 'Safeguarding SRHR in UN80 Reform — org sign-on',
    body: 'Feminist/SRHR advocacy sign-on aligned with Gender WG mandate.',
    starts_at: null,
    ends_at: null,
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSdFl0iVBh0ahYNSbu0NC08z3A9iVKySXk3ANSDSPxEQ-9jJXQ/viewform',
    created_by: 'seed-whatsapp-gender',
    created_at: '2026-01-12T12:00:00.000Z',
  },
  {
    id: 'act-adaptation-cw4-baku-nominations',
    wg_slug: 'adaptation',
    kind: 'submission',
    title: 'Apply — Climate Week 4 (Baku) Adaptation nominations',
    body: 'Nominate for Baku Adaptation Roadmap Workshop (7–8 Sep) and Adaptation Forum (9–10 Sep). Self-funded; hybrid.',
    starts_at: null,
    ends_at: '2026-07-27T23:59:00.000Z',
    url: 'https://forms.gle/Xr5PnNGSfYSwo5HB6',
    created_by: 'seed-whatsapp-adaptation',
    created_at: '2026-07-23T12:00:00.000Z',
  },
  {
    id: 'act-adaptation-sb64-central-doc',
    wg_slug: 'adaptation',
    kind: 'action_point',
    title: 'Adaptation WG SB64 central working document',
    body: 'Hub for SB64 positions, negotiation analysis, interventions, and WG 2026 resources toward COP31.',
    starts_at: null,
    ends_at: null,
    url: 'https://docs.google.com/document/d/1-pHu4hLJV1ohRWDfkDqYPAmJYDlq3luAA-ljy20x02w/edit',
    created_by: 'seed-whatsapp-adaptation',
    created_at: '2026-06-01T12:00:00.000Z',
  },
  {
    id: 'act-energy-gys-amplify',
    wg_slug: 'energy',
    kind: 'campaign',
    title: 'Amplify GYS 2026 inputs — Energy WG deadline 31 July',
    body: 'Energy WG consultation ran 26 July; members can still submit individual/org contributions before 31 July 23:59 UTC.',
    starts_at: null,
    ends_at: '2026-07-31T23:59:00.000Z',
    url: 'https://forms.gle/7Hw2ZQoxPvWzaotL9',
    created_by: 'seed-whatsapp-energy',
    created_at: '2026-07-26T13:30:00.000Z',
  },
  {
    id: 'act-energy-cop-e-campaign',
    wg_slug: 'energy',
    kind: 'campaign',
    title: 'Carnival of Policy for Energy (COP-E)',
    body: 'Continental programme gathering youth energy demands ahead of COP31. Watch Energy WG LinkedIn for updates.',
    starts_at: null,
    ends_at: null,
    url: 'https://www.linkedin.com/company/youngo-energy-working-group/',
    created_by: 'seed-whatsapp-energy',
    created_at: '2026-02-01T12:00:00.000Z',
  },
  {
    id: 'act-energy-virtual-cop-2026',
    wg_slug: 'energy',
    kind: 'campaign',
    title: 'Energy WG Virtual COP 2026 (coming)',
    body: 'Flagship Virtual COP planned for October 2026 (1–2 days). Registration TBA — watch Energy WG channels.',
    starts_at: '2026-10-01T00:00:00.000Z',
    ends_at: null,
    url: 'https://www.linkedin.com/company/youngo-energy-working-group/',
    created_by: 'seed-whatsapp-energy',
    created_at: '2026-07-14T12:00:00.000Z',
  },
]

for (const item of wgActs) summary[item.id] = upsertActivity(activities, item)
writeJson(ACTIVITIES, activities)

console.log(
  JSON.stringify(
    {
      ok: true,
      counts: {
        opportunities: opportunities.length,
        events: events.length,
        submissions: submissions.length,
        announcements: announcements.length,
        wgActivities: wgActs.length,
      },
      summary,
    },
    null,
    2,
  ),
)
