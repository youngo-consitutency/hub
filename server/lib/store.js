// Public content store. Fixtures provide the baseline; published event and
// announcement revisions replace matching fixture items by slug.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assembleFeed } from './feed.js'
import { getPool } from './db.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(
  readFileSync(path.join(here, '../../data/fixtures.json'), 'utf8'),
)
const signupsPath = path.join(here, '../../data/gys-signups.json')

const DAY = 86400000
const HOUR = 3600000

// Fixture dates are relative (dayOffset/hourUtc, deadlineInDays, daysAgo, startOffsetMin)
// so the demo always has a live meeting and deadlines in every urgency band.
function materialize(raw, now = new Date()) {
  const midnightUtc = Date.parse(
    new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z',
  )
  const iso = (ms) => new Date(ms).toISOString()
  const groups = raw.groups.map((g) => ({ isActive: true, ...g }))
  const bySlug = Object.fromEntries(groups.map((g) => [g.slug, g]))
  const wgRef = (slug) =>
    slug ? { slug, name: bySlug[slug]?.name || slug } : null

  const events = raw.events.map((e) => {
    const start =
      e.startOffsetMin != null
        ? now.getTime() + e.startOffsetMin * 60000
        : midnightUtc + (e.dayOffset || 0) * DAY + (e.hourUtc || 12) * HOUR
    return {
      slug: e.slug,
      title: e.title,
      type: e.type,
      description: e.description || null,
      meetingUrl: e.meetingUrl || null,
      recordingUrl: e.recordingUrl || null,
      startsAt: iso(start),
      endsAt: iso(start + (e.durationMin || 60) * 60000),
      wg: wgRef(e.wg),
    }
  })

  const submissions = raw.submissions.map((s) => ({
    slug: s.slug,
    title: s.title,
    status: s.status,
    deadlineAt:
      s.deadlineInDays != null
        ? iso(now.getTime() + s.deadlineInDays * DAY)
        : iso(now.getTime() - (s.deadlineDaysAgo || 0) * DAY),
    draftUrl: s.draftUrl || null,
    finalUrl: s.finalUrl || null,
    unfcccUrl: s.unfcccUrl || null,
    contributeNote: s.contributeNote || null,
    wg: wgRef(s.wg),
  }))

  const council = raw.council.map((d) => ({
    slug: d.slug,
    title: d.title,
    status: d.status,
    summary: d.summary || null,
    proposer: d.proposer || 'Focal points',
    proposalUrl: d.proposalUrl || null,
    finalUrl: d.finalUrl || null,
    respondNote: d.respondNote || null,
    outcomeNote: d.outcomeNote || null,
    inputDeadline:
      d.inputInDays != null ? iso(now.getTime() + d.inputInDays * DAY) : null,
    objectionDeadline:
      d.objectionInDays != null
        ? iso(now.getTime() + d.objectionInDays * DAY)
        : null,
    decidedAt:
      d.decidedDaysAgo != null
        ? iso(now.getTime() - d.decidedDaysAgo * DAY)
        : null,
    statusLog: (d.log || []).map((l) => ({
      status: l.status,
      note: l.note || null,
      at: iso(now.getTime() - (l.daysAgo || 0) * DAY),
    })),
  }))

  const announcements = raw.announcements.map((a) => ({
    slug: a.slug,
    title: a.title,
    body: a.body,
    pinned: !!a.pinned,
    ctaUrl: a.ctaUrl || null,
    ctaLabel: a.ctaLabel || null,
    ctaDeadlineAt: a.ctaDeadlineAt || null,
    publishedAt: iso(now.getTime() - (a.daysAgo || 0) * DAY),
  }))

  const coys = raw.coys.map((c) => ({ datesTbc: false, ...c }))

  const directory = raw.directory.map((c) => ({ ...c, wg: wgRef(c.wg) }))

  // GYS is static reference content (no relative dates), passed through untouched.
  const gys = raw.gys || null

  return {
    groups,
    events,
    submissions,
    council,
    announcements,
    coys,
    directory,
    gys,
  }
}

const data = materialize(raw)
let publishedEvents = new Map()
let publishedAnnouncements = new Map()

function mergedBySlug(base, additions) {
  const items = new Map(base.map((item) => [item.slug, item]))
  for (const [slug, item] of additions) items.set(slug, item)
  return [...items.values()]
}

function allEvents() {
  return mergedBySlug(data.events, publishedEvents)
}

function allAnnouncements() {
  return mergedBySlug(data.announcements, publishedAnnouncements)
}

export function setPublishedContent(items = []) {
  const groups = new Map(data.groups.map((group) => [group.slug, group]))
  const nextEvents = new Map()
  const nextAnnouncements = new Map()
  for (const item of items) {
    const payload = item?.payload || {}
    if (item?.contentType === 'event') {
      nextEvents.set(item.contentKey, {
        slug: item.contentKey,
        title: payload.title,
        type: payload.type,
        description: payload.description || null,
        meetingUrl: payload.meetingUrl || null,
        recordingUrl: payload.recordingUrl || null,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        wg: payload.wg
          ? {
              slug: payload.wg,
              name: groups.get(payload.wg)?.name || payload.wg,
            }
          : null,
      })
    }
    if (item?.contentType === 'announcement') {
      nextAnnouncements.set(item.contentKey, {
        slug: item.contentKey,
        title: payload.title,
        body: payload.body,
        pinned: Boolean(payload.pinned),
        ctaUrl: payload.ctaUrl || null,
        ctaLabel: payload.ctaLabel || null,
        ctaDeadlineAt: payload.ctaDeadlineAt || null,
        publishedAt: item.publishedAt,
      })
    }
  }
  publishedEvents = nextEvents
  publishedAnnouncements = nextAnnouncements
}

export function getFeed(now = new Date()) {
  return assembleFeed(
    { ...data, events: allEvents(), announcements: allAnnouncements() },
    now,
  )
}

export function listEvents({ type } = {}) {
  return allEvents()
    .filter((e) => !type || type === 'all' || e.type === type)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
}

export function listGroups() {
  return data.groups.filter((g) => g.isActive)
}

// ICS feeds include ongoing and upcoming events, optionally filtered by type or
// working group. The default window is 90 days.
export function listEventsForIcs(
  { type, wg } = {},
  now = new Date(),
  days = 90,
) {
  const horizon = now.getTime() + days * DAY
  return allEvents()
    .filter((e) => !type || type === 'all' || e.type === type)
    .filter((e) => !wg || e.wg?.slug === wg)
    .filter(
      (e) =>
        new Date(e.endsAt) >= now && new Date(e.startsAt).getTime() <= horizon,
    )
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
}

const OPEN_SUB_STATES = ['open', 'drafting', 'internal_review']

export function getGroup(slug, now = new Date()) {
  const group = data.groups.find((g) => g.slug === slug)
  if (!group) return null
  const events = allEvents()
    .filter((e) => e.wg?.slug === slug && new Date(e.endsAt) >= now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, 5)
  const submissions = data.submissions
    .filter((s) => s.wg?.slug === slug && OPEN_SUB_STATES.includes(s.status))
    .sort((a, b) => new Date(a.deadlineAt) - new Date(b.deadlineAt))
  const contact = data.directory.find((c) => c.wg?.slug === slug) || null
  return { ...group, events, submissions, contact }
}

export function getEvent(slug) {
  return allEvents().find((e) => e.slug === slug) || null
}

export function listAnnouncements() {
  return allAnnouncements().sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
  )
}

export function getSubmission(slug) {
  return data.submissions.find((s) => s.slug === slug) || null
}

export function getDecision(slug) {
  return data.council.find((d) => d.slug === slug) || null
}

export function getCoy(slug) {
  const coy = data.coys.find((c) => c.slug === slug)
  return coy && coy.reviewStatus === 'approved' ? coy : null
}

export function listSubmissions(state = 'open') {
  const openStates = ['open', 'drafting', 'internal_review']
  return data.submissions
    .filter((s) =>
      state === 'archive'
        ? !openStates.includes(s.status)
        : openStates.includes(s.status),
    )
    .sort((a, b) => new Date(a.deadlineAt) - new Date(b.deadlineAt))
}

const COUNCIL_ACTIVE = ['proposed', 'open_for_input', 'objection_window']

export function listCouncil(state = 'active') {
  const active = data.council.filter((d) => COUNCIL_ACTIVE.includes(d.status))
  const decided = data.council.filter((d) => !COUNCIL_ACTIVE.includes(d.status))
  if (state === 'decided') {
    return decided.sort(
      (a, b) => new Date(b.decidedAt || 0) - new Date(a.decidedAt || 0),
    )
  }
  const windowDeadline = (d) =>
    d.status === 'objection_window' ? d.objectionDeadline : d.inputDeadline
  return active.sort((a, b) =>
    String(windowDeadline(a) || '9999').localeCompare(
      String(windowDeadline(b) || '9999'),
    ),
  )
}

const COY_PRIORITY = {
  registration_open: 0,
  applications_open: 1,
  announced: 2,
  concluded: 3,
  cancelled: 4,
}

export function listCoys({ type, region } = {}) {
  return data.coys
    .filter((c) => c.reviewStatus === 'approved')
    .filter((c) => !type || type === 'all' || c.type === type)
    .filter((c) => !region || region === 'all' || c.region === region)
    .sort(
      (a, b) =>
        (COY_PRIORITY[a.status] ?? 9) - (COY_PRIORITY[b.status] ?? 9) ||
        String(a.startsOn || '9999').localeCompare(
          String(b.startsOn || '9999'),
        ),
    )
}

export function listDirectory({ member = false } = {}) {
  // Guest payload: roles + generic emails only. Personal handles arrive with members auth.
  return data.directory.map((c) => ({
    group: c.group,
    roleTitle: c.roleTitle,
    description: c.description,
    publicEmail: c.publicEmail || null,
    wg: c.wg || null,
    ...(member
      ? {
          personName: c.personName || null,
          channelValue: c.channelValue || null,
        }
      : {}),
  }))
}

export function getGys() {
  return data.gys
}

// GYS signups use PostgreSQL when configured and a local JSON file in fixture mode.
export async function addGysSignup(signup) {
  const record = { ...signup, at: new Date().toISOString() }
  const pool = getPool()
  if (pool) {
    await pool.query(
      'INSERT INTO gys_signups(cycle, name, email, country, organization) VALUES ($1, $2, $3, $4, $5)',
      [
        signup.cycle,
        signup.name,
        signup.email,
        signup.country,
        signup.organization,
      ],
    )
    return record
  }
  let list = []
  try {
    if (existsSync(signupsPath))
      list = JSON.parse(readFileSync(signupsPath, 'utf8'))
  } catch {
    list = []
  }
  list.push(record)
  writeFileSync(signupsPath, JSON.stringify(list, null, 2))
  return record
}

export function search(q) {
  const needle = q.trim().toLowerCase()
  if (!needle)
    return {
      events: [],
      submissions: [],
      decisions: [],
      coys: [],
      groups: [],
      contacts: [],
    }
  const hit = (...fields) =>
    fields.some((f) => f && String(f).toLowerCase().includes(needle))
  return {
    events: allEvents()
      .filter((e) => hit(e.title, e.description, e.wg?.name))
      .slice(0, 4),
    submissions: data.submissions
      .filter((s) => hit(s.title, s.wg?.name))
      .slice(0, 4),
    decisions: data.council.filter((d) => hit(d.title, d.summary)).slice(0, 4),
    coys: data.coys
      .filter(
        (c) => c.reviewStatus === 'approved' && hit(c.title, c.city, c.country),
      )
      .slice(0, 4),
    groups: data.groups.filter((g) => hit(g.name, g.focusLine)).slice(0, 4),
    contacts: data.directory
      .filter((c) => hit(c.roleTitle, c.description))
      .slice(0, 4),
  }
}
