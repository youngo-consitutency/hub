/* eslint-disable no-console */
/**
 * Seed the Hub's reference content (working groups, events, decisions
 * catalogues, announcements, resources) from the data files.
 *
 *   DATABASE_URL=... npx tsx scripts/seed.ts
 *
 * Idempotent: every record is upserted by its unique key, so re-running
 * refreshes content without dupes. No accounts are created here — test and
 * demo accounts are provisioned separately (tests create their own via the
 * local API; scripts/demo-accounts.ts provisions throwaway logins).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const legacyData = (name: string) =>
  JSON.parse(readFileSync(path.resolve(dirname, '../data', name), 'utf8'))

const NOW = new Date()
const DAY = 86_400_000

const dayOffset = (days: number, hourUtc = 12, min = 0) => {
  const d = new Date(Date.UTC(
    NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() + days,
    hourUtc, min, 0,
  ))
  return d.toISOString()
}
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString()
const daysAhead = (n: number, endOfDay = false) =>
  dayOffset(n, endOfDay ? 23 : 12, endOfDay ? 59 : 0)

async function upsert(
  payload: any,
  collection: string,
  where: Record<string, any>,
  data: Record<string, any>,
) {
  const existing = await payload.find({
    collection,
    where,
    limit: 1,
    overrideAccess: true,
    pagination: false,
  })
  if (existing.docs[0]) {
    return payload.update({
      collection,
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    })
  }
  return payload.create({ collection, data, overrideAccess: true })
}

async function main() {
  const payload = await getPayload({ config })
  const fixtures = legacyData('fixtures.json')
  const resources = legacyData('resource-hub.json')

  // ── Console admin (opt-in) ──────────────────────────────────────
  // Provision a Payload-console login only when credentials are
  // supplied — nothing is invented here.
  if (process.env.CONSOLE_EMAIL && process.env.CONSOLE_PASSWORD) {
    await upsert(
      payload,
      'users',
      { email: { equals: process.env.CONSOLE_EMAIL } },
      {
        email: process.env.CONSOLE_EMAIL,
        password: process.env.CONSOLE_PASSWORD,
      },
    )
    console.log('console user: provisioned')
  }

  // ── Working groups ────────────────────────────────────────────────
  for (const g of fixtures.groups) {
    await upsert(payload, 'working-groups', { slug: { equals: g.slug } }, {
      slug: g.slug,
      name: g.name,
      monogram: g.monogram,
      focusLine: g.focusLine,
      description: g.description || null,
      cadenceNote: g.cadenceNote || null,
      tags: (g.tags || []).map((t: string) => ({ tag: t })),
      resources: g.resources || [],
      whatsappUrl: g.whatsappUrl || null,
      groupUrl: g.groupUrl || null,
      driveUrl: g.driveUrl || null,
      isActive: g.isActive !== false,
    })
  }
  const wgId = new Map<string, number>()
  for (const doc of (
    await payload.find({ collection: 'working-groups', limit: 200, overrideAccess: true, pagination: false })
  ).docs) wgId.set(doc.slug, doc.id)
  console.log(`working-groups: ${wgId.size}`)

  // ── Events ────────────────────────────────────────────────────────
  for (const e of fixtures.events) {
    const startsAt = dayOffset(e.dayOffset ?? 7, e.hourUtc ?? 16)
    const endsAt = new Date(
      new Date(startsAt).getTime() + (e.durationMin ?? 60) * 60_000,
    ).toISOString()
    await upsert(payload, 'content-events', { slug: { equals: e.slug } }, {
      slug: e.slug,
      title: e.title,
      type: e.type,
      startsAt,
      endsAt,
      description: e.description || null,
      wg: e.wg && wgId.get(e.wg) ? wgId.get(e.wg) : null,
      meetingUrl: e.meetingUrl || null,
      recordingUrl: e.recordingUrl || null,
    })
  }
  console.log(`events: ${fixtures.events.length}`)

  // ── Submissions ───────────────────────────────────────────────────
  for (const s of fixtures.submissions) {
    await upsert(payload, 'content-submissions', { slug: { equals: s.slug } }, {
      slug: s.slug,
      title: s.title,
      status: s.status || 'open',
      deadlineAt: daysAhead(s.deadlineInDays ?? 14, true),
      wg: s.wg && wgId.get(s.wg) ? wgId.get(s.wg) : null,
      draftUrl: s.draftUrl || null,
      finalUrl: s.finalUrl || null,
      unfcccUrl: s.unfcccUrl || null,
      contributeNote: s.contributeNote || null,
    })
  }

  // ── COYs ──────────────────────────────────────────────────────────
  for (const c of fixtures.coys) {
    await upsert(payload, 'content-coys', { slug: { equals: c.slug } }, {
      slug: c.slug,
      type: c.type,
      title: c.title,
      country: c.country,
      city: c.city || null,
      region: c.region || null,
      startsOn: c.startsOn || null,
      endsOn: c.endsOn || null,
      datesTbc: Boolean(c.datesTbc),
      status: c.status,
      applicationsCloseAt: c.applicationsCloseAt || null,
      reviewStatus: c.reviewStatus || 'approved',
      organizerName: c.organizerName || null,
      organizerOrg: c.organizerOrg || null,
      registerUrl: c.registerUrl || null,
      websiteUrl: c.websiteUrl || null,
    })
  }

  // ── Announcements ─────────────────────────────────────────────────
  for (const a of fixtures.announcements) {
    await upsert(payload, 'content-announcements', { slug: { equals: a.slug } }, {
      slug: a.slug,
      title: a.title,
      body: a.body,
      pinned: Boolean(a.pinned),
      ctaUrl: a.ctaUrl || null,
      ctaLabel: a.ctaLabel || null,
      ctaDeadlineAt: a.ctaDeadlineAt || null,
      publishedAt: a.daysAgo != null ? daysAgo(a.daysAgo) : NOW.toISOString(),
    })
  }

  // ── Directory contacts ────────────────────────────────────────────
  for (const [i, c] of fixtures.directory.entries()) {
    const group = c.wg ? 'working_group' : c.group
    await upsert(
      payload,
      'directory-contacts',
      { group: { equals: group }, roleTitle: { equals: c.roleTitle } },
      {
        group,
        roleTitle: c.roleTitle,
        description: c.description || null,
        publicEmail: c.publicEmail || null,
        wg: c.wg && wgId.get(c.wg) ? wgId.get(c.wg) : null,
        personName: c.personName || null,
        channelValue: c.channelValue || null,
        sortOrder: i,
      },
    )
  }

  // ── GYS public content ────────────────────────────────────────────
  const gys = fixtures.gys
  await upsert(payload, 'gys-cycles', { isCurrent: { equals: true } }, {
    ...gys.current,
    priorities: gys.priorities,
    process: gys.process,
    archive: gys.archive,
    isCurrent: true,
  })

  // ── Opportunities ─────────────────────────────────────────────────
  for (const o of fixtures.opportunities) {
    await upsert(payload, 'opportunities', { slug: { equals: o.slug } }, {
      slug: o.slug,
      kind: o.kind,
      title: o.title,
      organizationName: o.organizationName || null,
      summary: o.summary || null,
      body: o.body || null,
      format: o.format || 'online',
      location: o.location || null,
      region: o.region || null,
      startsAt: o.startsAt || null,
      endsAt: o.endsAt || null,
      deadlineAt: o.deadlineAt || null,
      linkUrl: o.linkUrl || null,
      status: 'published',
      source: 'curated',
    })
  }

  // ── Resources (resource-hub catalogue) ────────────────────────────
  let resourceCount = 0
  for (const r of resources) {
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          r.slug, r.title, r.url, r.summary, r.publisher, r.pathway, r.type,
          [...(r.topics || [])].sort(), r.topic, r.region, r.language,
        ]),
      )
      .digest('hex')
    await upsert(payload, 'catalogue-resources', { slug: { equals: r.slug } }, {
      slug: r.slug,
      title: r.title,
      url: r.url,
      summary: r.summary || null,
      publisher: r.publisher || null,
      pathway: r.pathway || null,
      type: r.type || null,
      topic: r.topic || null,
      topics: r.topics || (r.topic ? [r.topic] : []),
      region: r.region || null,
      language: r.language || null,
      source: r.source || null,
      fingerprint,
      verificationStatus: r.verificationStatus || 'needs_verification',
    })
    resourceCount += 1
  }
  console.log(`resources: ${resourceCount}`)


  console.log('Seed complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
