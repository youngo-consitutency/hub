import { createHash } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import { assembleFeed } from './feed'
import { resolveCoyStatus } from '../../spa/shared/coyStatus.js'
import { normalizeTaskForces } from '../../spa/shared/taskForces.js'

type AnyRecord = Record<string, any>
type Req = PayloadRequest | Payload

const p = (req: Req): Payload => ('payload' in req ? req.payload : req)

const DAY = 86400000
const OPEN_SUB_STATES = ['open', 'drafting', 'internal_review']
const COUNCIL_ACTIVE = ['proposed', 'open_for_input', 'objection_window']

const findAll = async (
  req: Req,
  collection: string,
  where?: Record<string, unknown>,
  sort?: string,
): Promise<AnyRecord[]> => {
  const res = await p(req).find({
    collection: collection as never,
    where: where as never,
    sort,
    limit: 5000,
    depth: 1,
    pagination: false,
    overrideAccess: true,
  })
  return res.docs as AnyRecord[]
}

const wgRef = (doc: AnyRecord | null | undefined) =>
  doc ? { slug: doc.slug, name: doc.name } : null

function eventShape(e: AnyRecord): AnyRecord {
  return {
    slug: e.slug,
    title: e.title,
    type: e.type,
    description: e.description || null,
    meetingUrl: e.meetingUrl || null,
    recordingUrl: e.recordingUrl || null,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    wg: wgRef(e.wg),
  }
}

function submissionShape(s: AnyRecord): AnyRecord {
  return {
    slug: s.slug,
    title: s.title,
    status: s.status,
    deadlineAt: s.deadlineAt || null,
    draftUrl: s.draftUrl || null,
    finalUrl: s.finalUrl || null,
    unfcccUrl: s.unfcccUrl || null,
    contributeNote: s.contributeNote || null,
    wg: wgRef(s.wg),
  }
}

function councilShape(d: AnyRecord): AnyRecord {
  return {
    slug: d.slug,
    title: d.title,
    status: d.status,
    summary: d.summary || null,
    proposer: d.proposer || 'Focal points',
    proposalUrl: d.proposalUrl || null,
    finalUrl: d.finalUrl || null,
    respondNote: d.respondNote || null,
    outcomeNote: d.outcomeNote || null,
    inputDeadline: d.inputDeadline || null,
    objectionDeadline: d.objectionDeadline || null,
    decidedAt: d.decidedAt || null,
    statusLog: Array.isArray(d.statusLog) ? d.statusLog : [],
  }
}

function announcementShape(a: AnyRecord): AnyRecord {
  return {
    slug: a.slug,
    title: a.title,
    body: a.body,
    pinned: Boolean(a.pinned),
    ctaUrl: a.ctaUrl || null,
    ctaLabel: a.ctaLabel || null,
    ctaDeadlineAt: a.ctaDeadlineAt || null,
    publishedAt: a.publishedAt || a.createdAt,
  }
}

function coyView(coy: AnyRecord, now = new Date()): AnyRecord {
  return { ...coy, status: resolveCoyStatus(coy, now) }
}

function opportunityShape(o: AnyRecord): AnyRecord {
  return {
    id: o.id,
    slug: o.slug || null,
    orgAccountId:
      typeof o.orgAccount === 'object' ? o.orgAccount?.id : o.orgAccount || null,
    organizationName: o.organizationName || 'Shared opportunity',
    kind: o.kind,
    title: o.title,
    summary: o.summary || null,
    body: o.body || null,
    format: o.format || 'online',
    location: o.location || null,
    region: o.region || null,
    startsAt: o.startsAt || null,
    endsAt: o.endsAt || null,
    deadlineAt: o.deadlineAt || null,
    linkUrl: o.linkUrl || null,
    status: o.status,
    reviewNote: o.reviewNote || null,
    reviewedAt: o.reviewedAt || null,
    createdAt: o.createdAt,
    source: o.source || null,
  }
}

async function allGroups(req: Req): Promise<AnyRecord[]> {
  const groups = await findAll(
    req,
    'working-groups',
    { isActive: { equals: true } },
    'sortOrder',
  )
  return groups.map((g) => ({
    ...g,
    tags: (g.tags || []).map((t: AnyRecord) => t.tag ?? t),
    taskForces: normalizeTaskForces(g.taskForces, g.slug),
    publicSpace: Boolean(g.publicSpace),
    isActive: true,
  }))
}

export async function listGroups(req: Req): Promise<AnyRecord[]> {
  return allGroups(req)
}

export async function getGroup(req: Req, slug: string, now = new Date()) {
  const group = (await allGroups(req)).find((g) => g.slug === slug)
  if (!group) return null
  const events = (await listEvents(req))
    .filter((e) => e.wg?.slug === slug && new Date(e.endsAt) >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 5)
  const submissions = (await listSubmissionsRaw(req))
    .filter((s) => s.wg?.slug === slug && OPEN_SUB_STATES.includes(s.status))
    .sort(
      (a, b) =>
        new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime(),
    )
  const contact =
    (await listDirectory(req)).find((c) => c.wg?.slug === slug) || null
  return { ...group, events, submissions, contact }
}

async function listSubmissionsRaw(req: Req): Promise<AnyRecord[]> {
  return (await findAll(req, 'content-submissions', undefined, 'deadlineAt')).map(
    submissionShape,
  )
}

// Unpublished items vanish from both public and staff reads, matching the
// legacy publication-store behaviour (requireLiveItem → not_found).
const LIVE_ONLY = { state: { not_equals: 'unpublished' } }

export async function listEvents(
  req: Req,
  { type }: { type?: string } = {},
): Promise<AnyRecord[]> {
  const where =
    type && type !== 'all'
      ? { and: [{ type: { equals: type } }, LIVE_ONLY] }
      : LIVE_ONLY
  return (await findAll(req, 'content-events', where, 'startsAt')).map(eventShape)
}

export async function getEvent(req: Req, slug: string) {
  const docs = await findAll(req, 'content-events', {
    and: [{ slug: { equals: slug } }, LIVE_ONLY],
  })
  return docs[0] ? eventShape(docs[0]) : null
}

export async function listAnnouncements(req: Req): Promise<AnyRecord[]> {
  return (await findAll(req, 'content-announcements', LIVE_ONLY, '-publishedAt')).map(
    announcementShape,
  )
}

export async function getAnnouncement(req: Req, slug: string) {
  const docs = await findAll(req, 'content-announcements', {
    and: [{ slug: { equals: slug } }, LIVE_ONLY],
  })
  return docs[0] ? announcementShape(docs[0]) : null
}

export async function listSubmissions(req: Req, state = 'open') {
  const subs = await listSubmissionsRaw(req)
  return subs
    .filter((s) =>
      state === 'archive'
        ? !OPEN_SUB_STATES.includes(s.status)
        : OPEN_SUB_STATES.includes(s.status),
    )
    .sort(
      (a, b) =>
        new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime(),
    )
}

export async function getSubmission(req: Req, slug: string) {
  const subs = await listSubmissionsRaw(req)
  return subs.find((s) => s.slug === slug) || null
}

export async function listCouncil(req: Req, state = 'active') {
  const all = (await findAll(req, 'council-decisions')).map(councilShape)
  const active = all.filter((d) => COUNCIL_ACTIVE.includes(d.status))
  const decided = all.filter((d) => !COUNCIL_ACTIVE.includes(d.status))
  if (state === 'decided') {
    return decided.sort(
      (a, b) =>
        new Date(b.decidedAt || 0).getTime() - new Date(a.decidedAt || 0).getTime(),
    )
  }
  const windowDeadline = (d: AnyRecord) =>
    d.status === 'objection_window' ? d.objectionDeadline : d.inputDeadline
  return active.sort((a, b) =>
    String(windowDeadline(a) || '9999').localeCompare(
      String(windowDeadline(b) || '9999'),
    ),
  )
}

export async function getDecision(req: Req, slug: string) {
  const all = (await findAll(req, 'council-decisions', { slug: { equals: slug } })).map(
    councilShape,
  )
  return all[0] || null
}

const COY_PRIORITY: Record<string, number> = {
  registration_open: 0,
  applications_open: 1,
  applications_closed: 2,
  registration_closed: 2,
  announced: 3,
  concluded: 4,
  cancelled: 5,
}

export async function listCoys(
  req: Req,
  { type, region }: { type?: string; region?: string } = {},
) {
  return (await findAll(req, 'content-coys'))
    .filter((c) => c.reviewStatus === 'approved')
    .filter((c) => !type || type === 'all' || c.type === type)
    .filter((c) => !region || region === 'all' || c.region === region)
    .map((c) => coyView(c))
    .sort(
      (a, b) =>
        (COY_PRIORITY[a.status] ?? 9) - (COY_PRIORITY[b.status] ?? 9) ||
        String(a.startsOn || '9999').localeCompare(String(b.startsOn || '9999')),
    )
}

export async function getCoy(req: Req, slug: string) {
  const docs = await findAll(req, 'content-coys', { slug: { equals: slug } })
  const coy = docs[0]
  return coy && coy.reviewStatus === 'approved' ? coyView(coy) : null
}

export async function listDirectory(req: Req): Promise<AnyRecord[]> {
  return (await findAll(req, 'directory-contacts', undefined, 'sortOrder')).map(
    (c) => ({
      group: c.group,
      roleTitle: c.roleTitle,
      description: c.description,
      publicEmail: c.publicEmail || null,
      wg: wgRef(c.wg),
      personName: c.personName || null,
      channelValue: c.channelValue || null,
    }),
  )
}

export async function getGys(req: Req) {
  const cycles = await findAll(req, 'gys-cycles', { isCurrent: { equals: true } })
  const current = cycles[0]
  if (!current) return null
  return {
    current: {
      year: current.year,
      edition: current.edition,
      title: current.title,
      location: current.location,
      targetSession: current.targetSession,
      intro: current.intro,
      note: current.note,
      fullUrl: current.fullUrl,
      inputsUrl: current.inputsUrl,
      inputsDeadlineAt: current.inputsDeadlineAt,
      releaseUrl: current.releaseUrl,
    },
    priorities: current.priorities || [],
    process: current.process || [],
    archive: current.archive || [],
  }
}

export async function addGysSignup(
  req: Req,
  signup: { cycle: string; name: string; email: string; country?: string; organization?: string },
) {
  return p(req).create({
    collection: 'gys-contributions' as never,
    data: signup as never,
    overrideAccess: true,
  })
}

export async function getFeed(req: Req, now = new Date()) {
  const [events, submissions, council, announcements, coys] =
    await Promise.all([
      listEvents(req),
      listSubmissionsRaw(req),
      listCouncil(req, 'all'),
      listAnnouncements(req),
      listCoys(req),
    ])
  return assembleFeed({ events, submissions, council, announcements, coys }, now)
}

export async function listOpportunities(
  req: Req,
  { kind, format }: { kind?: string; format?: string } = {},
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - DAY).toISOString()
  const rows = await findAll(req, 'opportunities')
  return rows
    .map(opportunityShape)
    .filter((row) => row.status === 'published')
    .filter((row) => !row.endsAt || row.endsAt >= cutoff)
    .filter((row) => !kind || kind === 'all' || row.kind === kind)
    .filter((row) => !format || format === 'all' || row.format === format)
}

export function resourceFingerprint(item: any) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        item.slug,
        item.title,
        item.url,
        item.summary,
        item.publisher || null,
        item.pathway,
        item.type,
        [...(item.topics || [item.topic])].sort(),
        item.topic,
        item.region,
        item.language,
      ]),
    )
    .digest('hex')
}

export async function listResources(req: Req, { includeRetired = false } = {}) {
  const rows = await findAll(req, 'catalogue-resources', undefined, 'title')
  const issues = await p(req).find({
    collection: 'resource-issues',
    where: { resolvedAt: { exists: false } },
    limit: 1000,
    overrideAccess: true,
  })
  const openBySlug = new Map<string, number>()
  for (const i of issues.docs as any[]) {
    openBySlug.set(i.resourceSlug, (openBySlug.get(i.resourceSlug) || 0) + 1)
  }
  return rows
    .map((item: any) => {
      const view = {
        slug: item.slug,
        title: item.title,
        url: item.url,
        summary: item.summary || null,
        publisher: item.publisher || null,
        pathway: item.pathway,
        type: item.type,
        topics: item.topics || [item.topic].filter(Boolean),
        topic: item.topic || null,
        region: item.region || null,
        language: item.language || null,
        source: item.source || null,
        verification: {
          status: item.verificationStatus || 'needs_verification',
          checkedAt: item.checkedAt || null,
          openIssues: openBySlug.get(item.slug) || 0,
        },
      }
      return { ...view, fingerprint: resourceFingerprint(view) }
    })
    .filter((item: any) => includeRetired || item.verification.status !== 'retired')
}

export async function search(req: Req, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) {
    return {
      events: [],
      submissions: [],
      decisions: [],
      coys: [],
      groups: [],
      contacts: [],
    }
  }
  const hit = (...fields: unknown[]) =>
    fields.some((f) => f && String(f).toLowerCase().includes(needle))
  const [events, submissions, council, coys, groups, directory] =
    await Promise.all([
      listEvents(req),
      listSubmissionsRaw(req),
      listCouncil(req, 'all'),
      listCoys(req),
      allGroups(req),
      listDirectory(req),
    ])
  return {
    events: events
      .filter((e) => hit(e.title, e.description, e.wg?.name))
      .slice(0, 4),
    submissions: submissions
      .filter((s) => hit(s.title, s.wg?.name))
      .slice(0, 4),
    decisions: council.filter((d) => hit(d.title, d.summary)).slice(0, 4),
    coys: coys
      .filter((c) => hit(c.title, c.city, c.country))
      .slice(0, 4),
    groups: groups.filter((g) => hit(g.name, g.focusLine)).slice(0, 4),
    contacts: directory
      .filter((c) => hit(c.roleTitle, c.description))
      .slice(0, 4),
  }
}

// ICS feeds include ongoing and upcoming events, optionally filtered.
export async function listEventsForIcs(
  req: Req,
  { type, wg }: { type?: string; wg?: string } = {},
  now = new Date(),
  days = 90,
) {
  const horizon = now.getTime() + days * DAY
  return (await listEvents(req))
    .filter((e) => !type || type === 'all' || e.type === type)
    .filter((e) => !wg || e.wg?.slug === wg)
    .filter(
      (e) =>
        new Date(e.endsAt) >= now && new Date(e.startsAt).getTime() <= horizon,
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
}
