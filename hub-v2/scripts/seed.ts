/* eslint-disable no-console */
/**
 * Seed hub-v2 from the legacy fixture data + demo personas.
 *
 *   DATABASE_URL=... npx tsx scripts/seed.ts
 *
 * Idempotent: every record is upserted by its unique key (slug / email /
 * (account, scope) pair), so re-running refreshes content without dupes.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const legacyData = (name: string) =>
  JSON.parse(readFileSync(path.resolve(dirname, '../../data', name), 'utf8'))

const DEMO_DOMAIN = process.env.DEMO_EMAIL_DOMAIN || 'youngo.demo'
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'DemoPass123!'
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

async function ensureAccount(payload: any, def: any) {
  const email = `${def.local}@${DEMO_DOMAIN}`
  const base = {
    email,
    name: def.name,
    firstName: def.firstName,
    lastName: def.lastName,
    password: DEMO_PASSWORD,
    entityType: def.entityType || 'individual',
    membershipTrack: def.membershipTrack || 'network',
    country: def.country || 'Kenya',
    region: def.region || 'Africa',
    nationality: 'Kenyan',
    phone: def.phone || '+254 700 000 000',
    gender: 'Prefer not to say',
    ageBand: '18_35',
    dateOfBirth: '2000-01-15',
    motivation: 'YOUNGO Hub demo account.',
    policiesAccepted: true,
    membershipPolicyVersion: '2025-01',
    privacyConsent: true,
    privacyConsentAt: NOW.toISOString(),
    coiDeclared: true,
    memberOfAccreditedNgo: Boolean(def.memberOfAccreditedNgo),
    organizationName: def.organizationName || null,
    organizationType: def.organizationType || null,
    orgOperateIn: def.orgOperateIn || null,
    orgWebsite: def.orgWebsite || null,
    orgMission: def.orgMission || null,
    ycpName: def.ycpName || null,
    ycpEmail: def.ycpEmail || null,
    ycpPhone: def.ycpPhone || null,
    memberStatus: def.verified ? 'verified' : 'pending_course',
    hubAccessStatus: def.verified ? 'active' : 'pending_course',
    membershipStatus: def.verified ? 'active' : 'registered',
    constituencyWorkStatus:
      def.membershipTrack === 'constituency_work'
        ? def.verified
          ? 'active'
          : 'pending_onboarding'
        : null,
    role: def.role || 'member',
    teamRoles: def.teamRoles || [],
    wgInterests: def.wgInterests || [],
    verifiedAt: def.verified ? NOW.toISOString() : null,
    coursePassedAt: def.verified ? NOW.toISOString() : null,
    courseScore: def.verified ? 100 : null,
    emailVerifiedAt: def.verified ? NOW.toISOString() : null,
  }
  const account = await upsert(payload, 'accounts', { email: { equals: email } }, base)
  const accountId = account.id

  // Team + WG assignments.
  for (const teamRole of def.teamRoles || []) {
    await upsert(
      payload,
      'assignments',
      {
        account: { equals: accountId },
        scopeType: { equals: 'team' },
        scopeId: { equals: teamRole },
      },
      { account: accountId, scopeType: 'team', scopeId: teamRole, role: 'member', status: 'active', assignedBy: accountId },
    )
  }
  if (def.wg) {
    await upsert(
      payload,
      'assignments',
      {
        account: { equals: accountId },
        scopeType: { equals: 'working_group' },
        scopeId: { equals: def.wg.slug },
      },
      { account: accountId, scopeType: 'working_group', scopeId: def.wg.slug, role: def.wg.role, status: 'active', assignedBy: accountId },
    )
    await upsert(
      payload,
      'wg-progress',
      { account: { equals: accountId }, wgSlug: { equals: def.wg.slug } },
      {
        account: accountId,
        wgSlug: def.wg.slug,
        presentationOk: true,
        rulesOk: true,
        status: 'active',
        roleInWg: def.wg.role,
        unlockedAt: NOW.toISOString(),
      },
    )
  }
  if (def.ngoSeat) {
    const org = (
      await payload.find({
        collection: 'accounts',
        where: { email: { equals: def.ngoSeat.orgEmail } },
        limit: 1,
        overrideAccess: true,
      })
    ).docs[0]
    if (org) {
      await upsert(
        payload,
        'ngo-seats',
        {
          orgAccount: { equals: org.id },
          email: { equals: email },
        },
        {
          orgAccount: org.id,
          memberAccount: accountId,
          email,
          name: def.name,
          seatRole: def.ngoSeat.seatRole,
          status: 'active',
          acceptedAt: NOW.toISOString(),
          invitedBy: org.id,
        },
      )
    }
  }
  return account
}

async function main() {
  const payload = await getPayload({ config })
  const fixtures = legacyData('fixtures.json')
  const resources = legacyData('resource-hub.json')

  // ── Console admin (CMS login) ─────────────────────────────────────
  await upsert(
    payload,
    'users',
    { email: { equals: `admin@${DEMO_DOMAIN}` } },
    {
      email: `admin@${DEMO_DOMAIN}`,
      password: process.env.CONSOLE_PASSWORD || 'ConsoleAdmin123!',
    },
  )

  // ── Demo member accounts ─────────────────────────────────────────
  const orgEmail = `demo-org@${DEMO_DOMAIN}`
  const personas = [
    { local: 'demo-admin', name: 'Demo Admin', firstName: 'Demo', lastName: 'Admin', role: 'admin', verified: true },
    { local: 'demo-member', name: 'Demo Member', firstName: 'Demo', lastName: 'Member', verified: true },
    { local: 'demo-pending', name: 'Demo Pending', firstName: 'Demo', lastName: 'Pending', verified: false },
    { local: 'demo-focal', name: 'Demo Focal', firstName: 'Demo', lastName: 'Focal', role: 'focal_point', verified: true, membershipTrack: 'constituency_work' },
    { local: 'demo-wg-contact', name: 'Demo WgContact', firstName: 'Demo', lastName: 'WgContact', verified: true, wgInterests: ['finance'], wg: { slug: 'finance', role: 'contact' } },
    { local: 'demo-wg-lead', name: 'Demo Education Contact Point', firstName: 'Demo', lastName: 'WgLead', verified: true, wgInterests: ['ace'], wg: { slug: 'ace', role: 'contact' } },
    { local: 'demo-membership', name: 'Demo Membership', firstName: 'Demo', lastName: 'Membership', verified: true, teamRoles: ['membership_team'] },
    { local: 'demo-gys', name: 'Demo Gys', firstName: 'Demo', lastName: 'Gys', verified: true, teamRoles: ['gys_policy_team'] },
    { local: 'demo-editor', name: 'Demo Editor', firstName: 'Demo', lastName: 'Editor', verified: true, teamRoles: ['content_editor'] },
    { local: 'demo-publisher', name: 'Demo Publisher', firstName: 'Demo', lastName: 'Publisher', verified: true, teamRoles: ['content_publisher'] },
    {
      local: 'demo-org', name: 'Demo OrgAdmin', firstName: 'Demo', lastName: 'OrgAdmin',
      role: 'ngo_admin', verified: true, entityType: 'organization',
      organizationName: 'YOUNGO Demo Youth Network', organizationType: 'non_admitted',
      orgOperateIn: 'Kenya; East Africa', orgWebsite: 'https://example.org/youngo-demo',
      orgMission: 'Demo organisation for Hub persona testing.',
      ycpName: 'Demo OrgAdmin', ycpEmail: orgEmail, ycpPhone: '+254 700 000 099',
    },
    {
      local: 'demo-ngo-rep', name: 'Demo NgoRep', firstName: 'Demo', lastName: 'NgoRep',
      verified: true, memberOfAccreditedNgo: true,
      ngoSeat: { orgEmail, seatRole: 'representative' },
    },
  ]
  for (const p of personas) await ensureAccount(payload, p)
  // Owner seat for the demo org account itself.
  const org = (
    await payload.find({
      collection: 'accounts',
      where: { email: { equals: orgEmail } },
      limit: 1,
      overrideAccess: true,
    })
  ).docs[0]
  if (org) {
    await upsert(
      payload,
      'ngo-seats',
      { orgAccount: { equals: org.id }, email: { equals: orgEmail } },
      {
        orgAccount: org.id,
        memberAccount: org.id,
        email: orgEmail,
        name: org.name,
        seatRole: 'owner',
        status: 'active',
        acceptedAt: NOW.toISOString(),
        invitedBy: org.id,
      },
    )
  }
  console.log(`accounts: ${personas.length} personas`)

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

  // ── Council decisions ─────────────────────────────────────────────
  for (const c of fixtures.council) {
    await upsert(payload, 'council-decisions', { slug: { equals: c.slug } }, {
      slug: c.slug,
      title: c.title,
      status: c.status,
      summary: c.summary,
      proposer: c.proposer || null,
      proposalUrl: c.proposalUrl || null,
      finalUrl: c.finalUrl || null,
      respondNote: c.respondNote || null,
      outcomeNote: c.outcomeNote || null,
      inputDeadline: c.inputInDays != null ? daysAhead(c.inputInDays, true) : null,
      objectionDeadline:
        c.objectionInDays != null ? daysAhead(c.objectionInDays, true) : null,
      decidedAt: c.decidedDaysAgo != null ? daysAgo(c.decidedDaysAgo) : null,
      statusLog: (c.log || []).map((entry: any) => ({
        status: entry.status,
        at: entry.daysAgo != null ? daysAgo(entry.daysAgo) : NOW.toISOString(),
        note: entry.note || null,
      })),
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
