/**
 * One-way import of member data from the legacy Hub (Genn25369/YOUNGO-HUB,
 * Express + raw SQL). Restore the production pg_dump into a scratch database
 * and point LEGACY_DATABASE_URL at it; DATABASE_URL is this Hub's database.
 *
 *   LEGACY_DATABASE_URL=postgres://… DRY_RUN=1 npx tsx scripts/setup/import-legacy-members.ts
 *   LEGACY_DATABASE_URL=postgres://… npx tsx scripts/setup/import-legacy-members.ts
 *
 * Optional: LEGACY_COY_SLUG (default coy21) — the COY the legacy allowlist
 * and notices belong to; it must exist here with liveOps on.
 *
 * Accounts keep their legacy scrypt hash and are upgraded on first sign-in
 * (src/endpoints/auth.ts). Re-running converges: accounts match on legacyId,
 * authority records on provenance.assignmentId, everything else on its
 * natural key. An email already registered here without a legacyId is
 * reported and left alone. Sessions, tokens, agent keys and queue state are
 * never copied. Output carries counts and local ids only — no personal data.
 */
import type { AnyValue, Doc } from '../../src/lib/domain'
import { randomBytes } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import pg from 'pg'
import { getPayload } from 'payload'

// env must load before payload.config is evaluated
loadEnv({ path: '.env.local' })
loadEnv()
const { default: config } = await import('../../src/payload.config')
const { normaliseScopeType, resolveLegacyRole, recordKind, councilSeatFor } =
  await import('../../src/lib/authority')
const { getPgPool } = await import('../../src/lib/pg')
const { validatedPushEndpoint } = await import('../../src/lib/push')

const SOURCE = 'legacy_hub'
const dryRun = process.env.DRY_RUN === '1'
const coySlug = process.env.LEGACY_COY_SLUG || 'coy21'

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())

async function main() {
  if (!process.env.LEGACY_DATABASE_URL) {
    console.error(
      'Usage: LEGACY_DATABASE_URL=<restored dump> [DRY_RUN=1] npx tsx scripts/setup/import-legacy-members.ts',
    )
    process.exit(1)
  }
  const legacy = new pg.Client({ connectionString: process.env.LEGACY_DATABASE_URL })
  await legacy.connect()
  const payload = await getPayload({ config })
  const target = getPgPool()!
  const counts: Record<string, Record<string, number>> = {}
  const notes: string[] = []
  const tally = (section: string, key: string, n = 1) => {
    counts[section] ||= {}
    counts[section][key] = (counts[section][key] || 0) + n
  }

  const hasTable = async (table: string) =>
    (await legacy.query('select to_regclass($1) is not null as ok', [`public.${table}`])).rows[0].ok
  const rows = async (sql: string) => (await legacy.query(sql)).rows as Doc[]
  const hasCollection = (slug: string) => Boolean((payload.collections as AnyValue)[slug])

  // scalar fields a collection really has; relationships are mapped by hand
  const fieldNames = (slug: string) =>
    new Set<string>(
      (payload.collections as AnyValue)[slug].config.flattenedFields
        .filter((f: AnyValue) => !['relationship', 'upload', 'join'].includes(f.type))
        .map((f: AnyValue) => f.name),
    )
  const pick = (slug: string, row: Doc, skip: string[] = []) => {
    const names = fieldNames(slug)
    const out: Doc = {}
    for (const [col, value] of Object.entries(row)) {
      const key = camel(col)
      // never copy the legacy uuid into this side's integer id
      if (col === 'id' || skip.includes(col) || value === undefined) continue
      if (names.has(key)) out[key] = value
    }
    return out
  }

  async function upsert(
    section: string,
    slug: string,
    where: AnyValue,
    data: Doc,
    onCreate: Doc = {},
  ) {
    const found = await payload.find({
      collection: slug as never,
      where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    })
    const doc = found.docs[0] as Doc | undefined
    tally(section, doc ? 'updated' : 'created')
    if (dryRun) return doc ?? null
    // slug is dynamic, so the typed overloads can't follow it
    return doc
      ? ((await payload.update({
          collection: slug as AnyValue,
          id: doc.id,
          data: data as AnyValue,
          overrideAccess: true,
        })) as Doc)
      : ((await payload.create({
          collection: slug as AnyValue,
          data: { ...data, ...onCreate } as AnyValue,
          overrideAccess: true,
        })) as Doc)
  }

  // ── accounts ──────────────────────────────────────────────────────
  const accountId = new Map<string, number>()
  const legacyAccounts = await rows('select * from hub_accounts order by created_at')
  for (const a of legacyAccounts) {
    const email = String(a.email).trim().toLowerCase()
    const byLegacy = await payload.find({
      collection: 'accounts',
      where: { legacyId: { equals: a.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!byLegacy.docs[0]) {
      const byEmail = await payload.find({
        collection: 'accounts',
        where: { email: { equals: email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (byEmail.docs[0]) {
        tally('accounts', 'email_conflict')
        notes.push(
          `account ${byEmail.docs[0].id}: email already registered here without a legacyId — not merged`,
        )
        continue
      }
    }
    const data: Doc = {
      ...pick('accounts', a, [
        'id',
        'email',
        'role',
        'team_roles',
        'password_hash',
        'password_salt',
        'credential_epoch',
        'created_at',
      ]),
      email,
      role: 'member',
      legacyId: a.id,
    }
    const doc = await upsert('accounts', 'accounts', { legacyId: { equals: a.id } }, data, {
      // the legacy hash wins at sign-in; this random password is never shown to anyone
      password: randomBytes(24).toString('base64url'),
      legacyPasswordHash: a.password_hash,
      legacyPasswordSalt: a.password_salt,
      createdAt: a.created_at,
    })
    if (doc) accountId.set(a.id, doc.id)
    if (a.role === 'admin' || a.role === 'ngo_admin')
      notes.push(
        `account ${doc?.id ?? '(dry run)'}: legacy role ${a.role} has no authority role here — set up by hand`,
      )
  }
  const acc = (uuid: unknown) => (uuid ? (accountId.get(String(uuid)) ?? null) : null)

  // ── authority records ─────────────────────────────────────────────
  // legacy assignments + team_roles[] + the focal_point account role, one
  // record each, keyed by a provenance id so a rerun never duplicates
  const grants: Doc[] = (await rows('select * from account_assignments')).map((r) => ({
    ...r,
    provenanceId: r.id,
  }))
  for (const a of legacyAccounts) {
    for (const team of a.team_roles || [])
      grants.push({
        provenanceId: `team_roles:${a.id}:${team}`,
        account_id: a.id,
        scope_type: 'team',
        scope_id: team,
        role: 'member',
        status: 'active',
        starts_at: a.created_at,
      })
    if (a.role === 'focal_point')
      grants.push({
        provenanceId: `role:${a.id}:focal_point`,
        account_id: a.id,
        scope_type: 'platform',
        scope_id: 'platform',
        role: 'focal_point',
        status: 'active',
        starts_at: a.verified_at || a.created_at,
      })
  }
  const seen = new Set<string>()
  for (const g of grants) {
    const account = acc(g.account_id)
    if (!account && !dryRun) {
      tally('authority', 'no_account')
      continue
    }
    const scopeType = normaliseScopeType(g.scope_type)
    const scopeId =
      scopeType === 'organisation' ? String(acc(g.scope_id) ?? g.scope_id) : String(g.scope_id)
    const role =
      scopeType === 'platform' && g.role === 'focal_point'
        ? 'focal_point'
        : resolveLegacyRole(scopeType, scopeId, g.role)
    if (!role) tally('authority', 'unmapped_kept_verbatim')
    const finalRole = role ?? g.role
    // team_roles and team rows overlap; one active record per tuple
    const tuple = `${g.account_id}|${finalRole}|${scopeType}|${scopeId}|${g.status}`
    if (seen.has(tuple)) {
      tally('authority', 'duplicate_skipped')
      continue
    }
    seen.add(tuple)
    const existing = await target.query(
      `select id from authority_records where provenance->>'assignmentId' = $1 limit 1`,
      [g.provenanceId],
    )
    if (existing.rows[0]) {
      tally('authority', 'existing')
      continue
    }
    tally('authority', 'created')
    if (dryRun) continue
    await payload.create({
      collection: 'authority-records',
      data: {
        // missing accounts were skipped above
        account: account!,
        role: finalRole,
        kind: recordKind(scopeType, finalRole),
        scopeType: scopeType as AnyValue,
        scopeId,
        status: g.status,
        startsAt: g.starts_at || g.created_at,
        endsAt: g.ends_at || null,
        councilSeat: councilSeatFor(finalRole, { scopeId }) || null,
        recordedBy: acc(g.assigned_by),
        evidence: g.appointment_evidence || null,
        provenance: {
          source: SOURCE,
          assignmentId: g.provenanceId,
          assignmentRole: g.role,
          assignmentScope: `${g.scope_type}:${g.scope_id}`,
        },
      },
      overrideAccess: true,
    })
  }

  // ── working-group membership ──────────────────────────────────────
  for (const r of await rows('select * from wg_workspace_progress')) {
    const account = acc(r.account_id)
    if (!account && !dryRun) continue
    await upsert(
      'wg-progress',
      'wg-progress',
      { and: [{ account: { equals: account } }, { wgSlug: { equals: r.wg_slug } }] },
      { ...pick('wg-progress', r, ['account_id']), account },
    )
  }

  // ── member profiles and photos ────────────────────────────────────
  const names = new Map(legacyAccounts.map((a) => [a.id, a.name]))
  for (const r of await rows('select * from member_profiles')) {
    const account = acc(r.account_id)
    if (!account && !dryRun) continue
    await upsert(
      'member-profiles',
      'member-profiles',
      { account: { equals: account } },
      {
        ...pick('member-profiles', r, ['account_id', 'updated_by']),
        account,
        displayName: r.display_name || names.get(r.account_id),
      },
    )
  }
  for (const p of await rows('select * from member_profile_photos')) {
    const account = acc(p.account_id)
    tally('member-photos', 'copied')
    if (dryRun || !account) continue
    await target.query(
      `insert into member_profile_photos (account_id, content_type, bytes, byte_size, revision, updated_by, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (account_id) do update set content_type=excluded.content_type, bytes=excluded.bytes,
         byte_size=excluded.byte_size, revision=excluded.revision, updated_at=excluded.updated_at`,
      [account, p.content_type, p.bytes, p.byte_size, p.revision, acc(p.updated_by), p.updated_at],
    )
    await target.query(
      `update member_profiles set has_photo = true, photo_updated_at = $2 where account_id = $1`,
      [account, p.updated_at],
    )
  }

  // ── organisations ─────────────────────────────────────────────────
  for (const s of await rows('select * from ngo_seats')) {
    const orgAccount = acc(s.org_account_id)
    if (!orgAccount && !dryRun) continue
    // pending invites carry tokens; members re-invite here instead
    if (s.status === 'invited') {
      tally('ngo-seats', 'pending_invite_skipped')
      continue
    }
    await upsert(
      'ngo-seats',
      'ngo-seats',
      {
        and: [
          { orgAccount: { equals: orgAccount } },
          { email: { equals: String(s.email || '').toLowerCase() } },
        ],
      },
      {
        ...pick('ngo-seats', s, ['invite_token', 'invite_token_hash', 'invite_expires_at']),
        email: String(s.email || '').toLowerCase(),
        orgAccount,
        memberAccount: acc(s.member_account_id),
      },
    )
  }
  for (const r of await rows('select * from ngo_requests')) {
    const orgAccount = acc(r.org_account_id)
    if (!orgAccount && !dryRun) continue
    await upsert(
      'ngo-requests',
      'ngo-requests',
      { and: [{ orgAccount: { equals: orgAccount } }, { title: { equals: r.title } }] },
      { ...pick('ngo-requests', r), orgAccount, createdBy: acc(r.created_by) },
    )
  }
  const orgName = new Map(legacyAccounts.map((a) => [a.id, a.organization_name || a.name]))
  for (const o of await rows('select * from ngo_opportunities')) {
    const orgAccount = acc(o.org_account_id)
    if (!orgAccount && !dryRun) continue
    await upsert(
      'opportunities',
      'opportunities',
      { and: [{ orgAccount: { equals: orgAccount } }, { title: { equals: o.title } }] },
      {
        ...pick('opportunities', o, ['id', 'slug']),
        orgAccount,
        organizationName: orgName.get(o.org_account_id) || null,
        // legacy and local defaults differ, so the status is always explicit
        status: o.status,
        source: 'ngo',
      },
    )
  }
  for (const t of await rows('select * from ngo_opportunity_trust')) {
    const account = acc(t.org_account_id)
    tally('posting-trust', 'set')
    if (dryRun || !account) continue
    await payload.update({
      collection: 'accounts',
      id: account,
      data: { postingTrust: t.state, postingTrustNote: t.note || null },
      overrideAccess: true,
    })
  }

  // ── feedback ──────────────────────────────────────────────────────
  for (const f of await rows('select * from feedback_tickets')) {
    const account = acc(f.reporter_account_id)
    const data: Doc = {
      ...pick('feedback-tickets', f, ['id', 'body', 'page_path']),
      account,
      body: f.body || '(no description given)',
      pageUrl: f.page_path || null,
    }
    await upsert(
      'feedback-tickets',
      'feedback-tickets',
      { and: [{ title: { equals: f.title } }, { createdAt: { equals: f.created_at } }] },
      data,
      { createdAt: f.created_at },
    )
  }

  // ── membership appeals (identity proofs) ──────────────────────────
  for (const m of await rows('select * from membership_appeals')) {
    const account = acc(m.account_id)
    if (!account && !dryRun) continue
    const doc = await upsert(
      'membership-appeals',
      'membership-appeals',
      { and: [{ account: { equals: account } }, { createdAt: { equals: m.created_at } }] },
      {
        ...pick('membership-appeals', m, ['id', 'proof_bytes', 'reviewer_id', 'reviewer_note']),
        account,
        reviewedBy: acc(m.reviewer_id),
        reviewNote: m.reviewer_note || null,
      },
      { createdAt: m.created_at },
    )
    if (doc && !dryRun)
      await target.query('update membership_appeals set proof_bytes = $2 where id = $1', [
        doc.id,
        m.proof_bytes,
      ])
  }

  // ── notification preferences and push devices ────────────────────
  const prefs = new Map<string, Doc>()
  for (const s of await rows('select * from notification_settings'))
    prefs.set(s.account_id, {
      timezone: s.timezone,
      digestDay: s.digest_day,
      digestHourUtc: s.digest_hour_utc,
      email: {},
      pushEnabled: false,
    })
  for (const p of await rows('select * from notification_preferences')) {
    const entry = prefs.get(p.account_id) || { email: {}, pushEnabled: false }
    if (p.channel === 'email') entry.email[p.category] = Boolean(p.enabled)
    if (p.channel === 'push' && p.enabled) entry.pushEnabled = true
    prefs.set(p.account_id, entry)
  }
  const verified = new Set(legacyAccounts.filter((a) => a.email_verified_at).map((a) => a.id))
  for (const [uuid, entry] of prefs) {
    const account = acc(uuid)
    if (!account && !dryRun) continue
    // opt-in email needs a verified inbox, as the preferences endpoint requires
    if (!verified.has(uuid))
      for (const key of Object.keys(entry.email)) if (key !== 'group_mail') entry.email[key] = false
    await upsert(
      'notification-prefs',
      'notification-prefs',
      { account: { equals: account } },
      {
        ...entry,
        account,
      },
    )
  }
  for (const s of await rows('select * from push_subscriptions')) {
    const account = acc(s.account_id)
    let endpoint: string
    try {
      endpoint = validatedPushEndpoint(s.endpoint)
    } catch {
      tally('push-subscriptions', 'unsupported_endpoint')
      continue
    }
    if (!account && !dryRun) continue
    await upsert(
      'push-subscriptions',
      'push-subscriptions',
      { endpoint: { equals: endpoint } },
      { account, endpoint, keys: s.keys, userAgent: s.user_agent || null },
    )
  }

  // ── Global Youth Statement ────────────────────────────────────────
  for (const s of await rows('select * from gys_signups')) {
    await upsert(
      'gys-contributions',
      'gys-contributions',
      {
        and: [{ cycle: { equals: s.cycle } }, { email: { equals: String(s.email).toLowerCase() } }],
      },
      { ...pick('gys-contributions', s, ['id']), email: String(s.email).toLowerCase() },
      { createdAt: s.created_at },
    )
  }
  const cycleId = new Map<string, number>()
  for (const c of await rows('select * from gys_cycles')) {
    const doc = await upsert(
      'gys-workflow-cycles',
      'gys-workflow-cycles',
      { code: { equals: c.code } },
      pick('gys-workflow-cycles', c, ['id']),
    )
    if (doc) cycleId.set(c.id, doc.id)
  }
  for (const g of await rows('select * from gys_contributions')) {
    const cycle = cycleId.get(g.cycle_id)
    if (!cycle) {
      // a dry run never creates the cycle, so its contributions count as new
      if (dryRun) tally('gys-tracked-contributions', 'created')
      continue
    }
    await upsert(
      'gys-tracked-contributions',
      'gys-tracked-contributions',
      {
        and: [
          { cycle: { equals: cycle } },
          g.external_id
            ? { externalId: { equals: g.external_id } }
            : { title: { equals: g.title } },
        ],
      },
      {
        ...pick('gys-tracked-contributions', g, ['id', 'cycle_id', 'author_id', 'reviewer_id']),
        cycle,
        author: acc(g.author_id),
        reviewer: acc(g.reviewer_id),
      },
    )
  }

  // ── collections added by the migration PRs, when present ──────────
  if (hasCollection('guardian-enquiries') && (await hasTable('guardian_enquiries'))) {
    for (const e of await rows('select * from guardian_enquiries'))
      await upsert(
        'guardian-enquiries',
        'guardian-enquiries',
        {
          and: [
            { guardianEmail: { equals: e.guardian_email } },
            { consentedAt: { equals: e.consented_at } },
          ],
        },
        pick('guardian-enquiries', e, ['id']),
        { createdAt: e.created_at },
      )
  } else tally('skipped', 'guardian_enquiries (collection not merged yet)')

  if (hasCollection('coy-participants') && (await hasTable('coy_participant_allowlist'))) {
    const coy = (
      await payload.find({
        collection: 'content-coys',
        where: { slug: { equals: coySlug } },
        limit: 1,
        overrideAccess: true,
      })
    ).docs[0] as Doc | undefined
    if (!coy) notes.push(`COY ${coySlug} not found — allowlist and notices not imported`)
    else {
      for (const p of await rows('select * from coy_participant_allowlist')) {
        const account = acc(p.account_id)
        if (!account && !dryRun) continue
        await upsert(
          'coy-participants',
          'coy-participants',
          { and: [{ coy: { equals: coy.id } }, { account: { equals: account } }] },
          { coy: coy.id, account, email: p.email, note: p.note || null, addedBy: acc(p.added_by) },
        )
      }
      for (const n of await rows('select * from coy_notices')) {
        const author = acc(n.author_id)
        if (!author && !dryRun) continue
        await upsert(
          'coy-notices',
          'coy-notices',
          { campaignId: { equals: `legacy:${n.id}` } },
          {
            coy: coy.id,
            title: n.title,
            body: n.body,
            channels: n.channels,
            campaignId: `legacy:${n.id}`,
            author,
          },
          { createdAt: n.created_at },
        )
      }
    }
  } else tally('skipped', 'coy allowlist and notices (collections not merged yet)')

  // ── not imported: reported so nothing goes missing silently ──────
  for (const table of [
    'mail_drafts',
    'governance_audit',
    'intelligence_notes',
    'platform_decisions',
    'email_suppressions',
    'gys_reviews',
    'gys_status_log',
  ])
    if (await hasTable(table)) {
      const n = (await legacy.query(`select count(*)::int as n from ${table}`)).rows[0].n
      if (n) tally('not_imported', table, n)
    }

  for (const [section, values] of Object.entries(counts))
    console.log(
      `${section}: ${Object.entries(values)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ')}`,
    )
  for (const note of notes) console.log(`note — ${note}`)
  console.log(dryRun ? 'Dry run — nothing written.' : 'Import finished.')
  await legacy.end()
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
