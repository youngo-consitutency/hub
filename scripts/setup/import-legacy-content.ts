/**
 * One-way import of the legacy Hub's public content (the Vite/Express app at
 * github.com/Genn25369/YOUNGO-HUB) into this database. The data stays out of
 * this repo: point LEGACY_DIR at a checkout of that repo.
 *
 *   LEGACY_DIR=../legacy-hub DRY_RUN=1 npx tsx scripts/setup/import-legacy-content.ts
 *   LEGACY_DIR=../legacy-hub npx tsx scripts/setup/import-legacy-content.ts
 *
 * Reads data/fixtures.json and data/resource-hub.json, plus the WG onboarding
 * decks and copy in src/content/*.js, which become content-documents.
 *
 * Optional: FIXTURE_ANCHOR=<iso date>. Legacy fixtures store relative dates
 * (dayOffset, daysAgo, deadlineInDays) that the old server resolved against
 * "now" on every request; this import freezes them against the anchor, which
 * defaults to the time of the run.
 *
 * Upserts by slug (directory contacts by group + roleTitle + publicEmail), so re-running
 * converges instead of duplicating. Nothing is deleted: rows this database
 * holds that the legacy source lacks (old demo seed) are listed at the end
 * for a deliberate cleanup. Council fixtures are not imported: the
 * decision-proposals model needs a real proposer account.
 */
import type { AnyValue } from '../../src/lib/domain'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { getPayload } from 'payload'

// Env must load before payload.config is evaluated.
loadEnv({ path: '.env.local' })
loadEnv()
const { default: config } = await import('../../src/payload.config')

const SOURCE = 'legacy_hub_fixtures'
const DAY = 86_400_000
const legacyDir = process.env.LEGACY_DIR || ''
const dryRun = process.env.DRY_RUN === '1'
const anchor = process.env.FIXTURE_ANCHOR ? new Date(process.env.FIXTURE_ANCHOR) : new Date()

const iso = (ms: number) => new Date(ms).toISOString()
const daysAgo = (n: number) => iso(anchor.getTime() - n * DAY)
const atDay = (days: number, hourUtc = 12, min = 0) =>
  iso(
    Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth(),
      anchor.getUTCDate() + days,
      hourUtc,
      min,
    ),
  )
const endOfDay = (days: number) => atDay(days, 23, 59)
const orNull = <T>(value: T) => (value === undefined || value === '' ? null : value)

function readJson(name: string): AnyValue {
  return JSON.parse(readFileSync(join(legacyDir, 'data', name), 'utf8'))
}

async function legacyModule(path: string): Promise<AnyValue> {
  return import(pathToFileURL(join(legacyDir, path)).href)
}

// fixture rows that exist to exercise the old UI, not real content
const isTestFixture = (slug: string) => /-example$/.test(slug)

async function main() {
  if (!legacyDir || Number.isNaN(anchor.getTime())) {
    console.error('Usage: LEGACY_DIR=<legacy checkout> [DRY_RUN=1] [FIXTURE_ANCHOR=<iso>]')
    process.exit(1)
  }
  const fixtures = readJson('fixtures.json')
  const resources = readJson('resource-hub.json')
  const payload = await getPayload({ config })
  const counts: Record<string, { created: number; updated: number }> = {}
  const seen: Record<string, Set<string>> = {}

  async function upsert(collection: string, where: AnyValue, data: AnyValue) {
    const tally = (counts[collection] ||= { created: 0, updated: 0 })
    const existing = await payload.find({
      collection: collection as AnyValue,
      where,
      limit: 1,
      overrideAccess: true,
      pagination: false,
    })
    const doc = existing.docs[0]
    tally[doc ? 'updated' : 'created'] += 1
    if (dryRun) return doc
    return doc
      ? payload.update({
          collection: collection as AnyValue,
          id: doc.id,
          data,
          overrideAccess: true,
        })
      : payload.create({ collection: collection as AnyValue, data, overrideAccess: true })
  }
  const bySlug = (slug: string) => ({ slug: { equals: slug } })
  async function upsertBySlug(collection: string, data: AnyValue) {
    ;(seen[collection] ||= new Set()).add(data.slug)
    return upsert(collection, bySlug(data.slug), data)
  }

  for (const [i, g] of fixtures.groups.entries()) {
    await upsertBySlug('working-groups', {
      slug: g.slug,
      name: g.name,
      monogram: orNull(g.monogram),
      focusLine: orNull(g.focusLine),
      cadenceNote: orNull(g.cadenceNote),
      tags: (g.tags || []).map((tag: string) => ({ tag })),
      resources: g.resources || [],
      taskForces: g.taskForces || null,
      whatsappUrl: orNull(g.whatsappUrl),
      groupUrl: orNull(g.groupUrl),
      driveUrl: orNull(g.driveUrl),
      publicSpace: Boolean(g.publicSpace),
      sortOrder: i,
    })
  }
  // in a dry run new groups have no ids yet, so wg links resolve only for existing rows
  const wgId = new Map<string, number>()
  const groups = await payload.find({
    collection: 'working-groups',
    limit: 500,
    overrideAccess: true,
    pagination: false,
  })
  for (const doc of groups.docs) wgId.set(doc.slug, doc.id as number)
  const wg = (slug?: string) => (slug && wgId.get(slug)) || null

  for (const e of fixtures.events) {
    const startsAt = atDay(e.dayOffset ?? 0, e.hourUtc ?? 12)
    await upsertBySlug('content-events', {
      slug: e.slug,
      title: e.title,
      type: e.type || 'wg_call',
      startsAt,
      endsAt: iso(new Date(startsAt).getTime() + (e.durationMin ?? 60) * 60_000),
      description: orNull(e.description),
      wg: wg(e.wg),
      meetingUrl: orNull(e.meetingUrl),
      recordingUrl: orNull(e.recordingUrl),
      state: 'published',
      legacySource: SOURCE,
    })
  }

  for (const s of fixtures.submissions) {
    await upsertBySlug('content-submissions', {
      slug: s.slug,
      title: s.title,
      status: s.status || 'open',
      deadlineAt:
        s.deadlineInDays != null
          ? endOfDay(s.deadlineInDays)
          : s.deadlineDaysAgo != null
            ? daysAgo(s.deadlineDaysAgo)
            : null,
      wg: wg(s.wg),
      draftUrl: orNull(s.draftUrl),
      finalUrl: orNull(s.finalUrl),
      unfcccUrl: orNull(s.unfcccUrl),
      contributeNote: orNull(s.contributeNote),
    })
  }

  for (const c of fixtures.coys) {
    if (isTestFixture(c.slug)) continue
    await upsertBySlug('content-coys', {
      slug: c.slug,
      type: c.type || 'coy',
      title: c.title,
      country: orNull(c.country),
      city: orNull(c.city),
      region: orNull(c.region),
      startsOn: orNull(c.startsOn),
      endsOn: orNull(c.endsOn),
      datesTbc: Boolean(c.datesTbc),
      status: orNull(c.status),
      applicationsCloseAt: orNull(c.applicationsCloseAt),
      reviewStatus: c.reviewStatus || 'pending',
      organizerName: orNull(c.organizerName),
      organizerOrg: orNull(c.organizerOrg),
      organizerEmail: orNull(c.organizerEmail),
      registerUrl: orNull(c.registerUrl),
      websiteUrl: orNull(c.websiteUrl),
      instagramUrl: orNull(c.instagramUrl),
      statementUrl: orNull(c.statementUrl),
    })
  }

  for (const a of fixtures.announcements) {
    await upsertBySlug('content-announcements', {
      slug: a.slug,
      title: a.title,
      body: a.body,
      pinned: Boolean(a.pinned),
      ctaUrl: orNull(a.ctaUrl),
      ctaLabel: orNull(a.ctaLabel),
      ctaDeadlineAt: orNull(a.ctaDeadlineAt),
      publishedAt: daysAgo(a.daysAgo ?? 0),
      state: 'published',
    })
  }

  for (const [i, c] of fixtures.directory.entries()) {
    await upsert(
      'directory-contacts',
      // two focal points share a role title, so the public email disambiguates
      {
        group: { equals: c.group },
        roleTitle: { equals: c.roleTitle },
        ...(c.publicEmail ? { publicEmail: { equals: c.publicEmail } } : {}),
      },
      {
        group: c.group,
        roleTitle: c.roleTitle,
        description: orNull(c.description),
        publicEmail: orNull(c.publicEmail),
        wg: wg(c.wg),
        sortOrder: i,
      },
    )
  }

  const { current, priorities, process: gysProcess, archive } = fixtures.gys
  await upsert(
    'gys-cycles',
    { year: { equals: current.year } },
    { ...current, priorities, process: gysProcess, archive, isCurrent: true },
  )

  for (const o of fixtures.opportunities) {
    await upsertBySlug('opportunities', {
      slug: o.slug,
      kind: o.kind,
      title: o.title,
      organizationName: orNull(o.organizationName),
      summary: orNull(o.summary),
      body: orNull(o.body),
      format: o.format || 'online',
      location: orNull(o.location),
      region: orNull(o.region),
      startsAt: orNull(o.startsAt),
      endsAt: orNull(o.endsAt),
      deadlineAt: o.deadlineInDays != null ? endOfDay(o.deadlineInDays) : orNull(o.deadlineAt),
      linkUrl: orNull(o.linkUrl),
      status: 'published',
      source: SOURCE,
    })
  }

  for (const r of resources) {
    await upsertBySlug('catalogue-resources', {
      slug: r.slug,
      title: r.title,
      url: r.url,
      summary: orNull(r.summary),
      publisher: orNull(r.publisher),
      pathway: orNull(r.pathway),
      type: orNull(r.type),
      topic: orNull(r.topic),
      topics: r.topics || (r.topic ? [r.topic] : []),
      region: orNull(r.region),
      language: orNull(r.language),
      source: orNull(r.source),
    })
  }

  // WG onboarding: per-group decks and copy, read by Workspace.tsx
  const { WG_SELF_PACED } = await legacyModule('src/content/jtOnboardingCourse.js')
  const { WG_ONBOARDING } = await legacyModule('src/content/wgOnboarding.js')
  const { WG_DECK_BRAND } = await legacyModule('src/content/wgDeckBrand.js')
  const map: Record<string, string> = {}
  for (const [wgSlug, course] of Object.entries<AnyValue>(WG_SELF_PACED)) {
    map[wgSlug] = `course-${wgSlug}`
    await upsertBySlug('content-documents', {
      slug: map[wgSlug],
      title: course.title,
      body: { COURSE: course },
    })
  }
  const currentMap = await payload.find({
    collection: 'content-documents',
    where: bySlug('self-paced-map'),
    limit: 1,
    overrideAccess: true,
  })
  await upsertBySlug('content-documents', {
    slug: 'self-paced-map',
    title: 'Self-paced WG courses',
    body: { map: { ...((currentMap.docs[0]?.body as AnyValue)?.map || {}), ...map } },
  })
  await upsertBySlug('content-documents', {
    slug: 'wg-onboarding',
    title: 'WG onboarding',
    body: { WG_ONBOARDING },
  })
  await upsertBySlug('content-documents', {
    slug: 'wg-deck-brand',
    title: 'WG deck brand',
    body: { WG_DECK_BRAND },
  })

  for (const [collection, { created, updated }] of Object.entries(counts)) {
    console.log(`${collection}: ${created} created, ${updated} updated`)
  }
  // content-documents holds more than legacy docs, so only content collections are compared
  for (const [collection, slugs] of Object.entries(seen)) {
    if (collection === 'content-documents') continue
    const all = await payload.find({
      collection: collection as AnyValue,
      limit: 5000,
      overrideAccess: true,
      pagination: false,
      depth: 0,
    })
    const extra = all.docs.map((d: AnyValue) => d.slug).filter((slug) => !slugs.has(slug))
    if (extra.length) console.log(`not in legacy source — ${collection}: ${extra.join(', ')}`)
  }
  console.log(dryRun ? 'Dry run — nothing written.' : `Imported as of ${anchor.toISOString()}.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
