import { accountView } from './accounts'
import { profileShape } from './membershipReview'
import { AUTHORITY_ROLES } from './authority'
import { requirePgPool, getPgPool } from './pg'
import type { Doc, AccountLike, AccountView } from './domain'

// Member directory: profile rows, relationship maps and visibility-safe
// person shapes for the member interface.

// Port of server/lib/memberProfiles.js people listing / safePerson.

const WEBSITE_PERMISSIONS = ['content_editor', 'content_publisher']

const wgDutyRoleLabel = (role: string | null | undefined) =>
  role === 'lead' ? 'Lead' : role === 'contact' ? 'Contact Point' : null

async function profileRow(accountId: number) {
  const pool = getPgPool()
  if (!pool) return null
  const { rows } = await pool.query(
    `SELECT p.*,
            ph.updated_at AS photo_updated_at,
            (ph.account_id IS NOT NULL) AS has_photo
     FROM member_profiles p
     LEFT JOIN member_profile_photos ph ON ph.account_id=p.account_id
     WHERE p.account_id=$1`,
    [accountId],
  )
  return rows[0] || null
}

async function relationshipMaps(accounts: Doc[]) {
  const ids = accounts.map((account) => account.id)
  const progressByAccount = new Map<number, any[]>(ids.map((id) => [id, []]))
  const orgByAccount = new Map<number, Doc>()
  const mandateByAccount = new Map<number, string>()
  if (!ids.length) return { progressByAccount, orgByAccount, mandateByAccount }
  const pool = getPgPool()
  if (!pool) return { progressByAccount, orgByAccount, mandateByAccount }
  const [progressResult, seatsResult, wgResult, optionsResult, mandateResult] = await Promise.all([
    pool.query(
      `SELECT account_id, wg_slug, role_in_wg, status
         FROM wg_progress
         WHERE account_id=ANY($1::int[])
           AND status IN ('interested','pending_approval','active')
         ORDER BY joined_at ASC`,
      [ids],
    ),
    pool.query(
      `SELECT s.member_account_id, s.seat_role,
                COALESCE(o.organization_name, o.name) AS organization_name
         FROM ngo_seats s
         JOIN accounts o ON o.id=s.org_account_id
         WHERE s.member_account_id=ANY($1::int[]) AND s.status='active'`,
      [ids],
    ),
    // Working-group names and staff labels live in the database.
    pool.query(`SELECT slug, name FROM working_groups`),
    pool.query(`SELECT body FROM content_documents WHERE slug='content-options'`),
    // Platform-scope mandates replace the old account-role badge.
    pool.query(
      `SELECT account_id, role FROM authority_records
         WHERE account_id=ANY($1::int[]) AND status='active' AND scope_type='platform'`,
      [ids],
    ),
  ])
  for (const row of mandateResult.rows)
    mandateByAccount.set(row.account_id, AUTHORITY_ROLES[row.role]?.label || row.role)
  for (const row of progressResult.rows) progressByAccount.get(row.account_id)?.push(row)
  for (const row of seatsResult.rows)
    orgByAccount.set(row.member_account_id, {
      name: row.organization_name,
      seatRole: row.seat_role,
    })
  const workingGroupNames = Object.fromEntries(
    (wgResult.rows || []).map((g: any) => [g.slug, g.name]),
  )
  const teamLabels = Object.fromEntries(
    (optionsResult.rows[0]?.body?.teamLabels || []).map((t: any) => [t.value, t.label]),
  )
  return { progressByAccount, orgByAccount, workingGroupNames, teamLabels, mandateByAccount }
}

function relationshipsFor(account: AccountLike, maps: any) {
  const wgName = (slug: string) => maps.workingGroupNames?.[slug] || slug
  const progress = maps.progressByAccount.get(account.id) || []
  const bySlug = new Map<string, Doc>()
  for (const item of progress)
    bySlug.set(item.wg_slug, {
      slug: item.wg_slug,
      name: wgName(item.wg_slug),
      role: item.role_in_wg || 'member',
      status: item.status,
    })
  for (const slug of account.wgInterests || [])
    if (!bySlug.has(slug))
      bySlug.set(slug, {
        slug,
        name: wgName(slug),
        role: 'interested',
        status: 'interested',
      })
  return {
    workingGroups: [...bySlug.values()],
    teams: (account.teamRoles || [])
      .filter((role: string) => !WEBSITE_PERMISSIONS.includes(role))
      .map((slug: string) => ({
        slug,
        name: maps.teamLabels?.[slug] || slug.replaceAll('_', ' '),
      })),
    organization: maps.orgByAccount.get(account.id) || null,
    platformRole: maps.mandateByAccount?.get(account.id) || null,
  }
}

function safePerson(
  profile: any,
  account: AccountLike,
  relationships: any,
  { duty = false, workingGroup = '' } = {},
) {
  const group = workingGroup
    ? relationships.workingGroups.find((item: Doc) => item.slug === workingGroup)
    : null
  const contactRole = wgDutyRoleLabel(group?.role)
  const showLocation = duty || profile.showCountry
  const directoryOpen = profile.directoryVisibility === 'members'
  return {
    id: account.id,
    displayName: profile.displayName,
    headline: directoryOpen ? profile.headline : '',
    bio: directoryOpen ? profile.bio : '',
    pronouns: directoryOpen ? profile.pronouns : '',
    expertiseTags: directoryOpen ? profile.expertiseTags : [],
    country: showLocation ? account.country || null : null,
    region: showLocation ? account.region || null : null,
    roleTitle: profile.roleTitle || contactRole,
    contactRole,
    organization: duty || profile.showOrganization ? relationships.organization : null,
    workingGroups: duty || profile.showWorkingGroups ? relationships.workingGroups : [],
    teams: duty || profile.showRoles ? relationships.teams : [],
    platformRole: duty || profile.showRoles ? relationships.platformRole : null,
    photoUrl: profile.photoUrl,
    updatedAt: profile.updatedAt,
  }
}

function cleanPageNumber(value: any) {
  const n = Number.parseInt(value, 10) || 1
  return Math.min(50, Math.max(1, n))
}

export async function listMemberPeople({
  search = '',
  tag = '',
  workingGroup = '',
  workingGroupRole = '',
  page = 1,
  pageSize = 24,
}: any = {}) {
  const cleanSearch = String(search).trim().slice(0, 120)
  const cleanTag = String(tag).trim().slice(0, 32)
  const cleanWg = String(workingGroup).trim().slice(0, 80)
  const cleanWgRole = ['manager', 'participant'].includes(workingGroupRole) ? workingGroupRole : ''
  const cleanPage = Number.parseInt(page, 10) || 1
  const cleanPageSize = cleanPageNumber(pageSize)
  const dutyManagers = cleanWgRole === 'manager' && Boolean(cleanWg)
  const pool = requirePgPool()
  let currentPage = cleanPage
  let total = 0
  let accounts: AccountView[] = []
  let profileRows: Doc[] = []

  const values: any[] = []
  const where = [
    ...(dutyManagers ? [] : [`p.directory_visibility='members'`]),
    `a.entity_type='individual'`,
    `a.member_status='verified'`,
    `a.hub_access_status='active'`,
  ]
  const add = (sql: string, value: any) => {
    values.push(value)
    where.push(sql.replaceAll('?', `$${values.length}`))
  }
  if (cleanSearch)
    add(
      `concat_ws(' ', COALESCE(NULLIF(p.display_name,''), a.name), p.headline, array_to_string(p.expertise_tags, ' ')) ILIKE ?`,
      `%${cleanSearch}%`,
    )
  if (cleanTag)
    add(`EXISTS (SELECT 1 FROM unnest(p.expertise_tags) t WHERE lower(t)=lower(?))`, cleanTag)
  if (cleanWg) {
    values.push(cleanWg)
    const slot = `$${values.length}`
    where.push(
      `(a.wg_interests ? ${slot} OR EXISTS (
        SELECT 1 FROM wg_progress w
        WHERE w.account_id=a.id AND w.wg_slug=${slot}
          AND w.status IN ('interested','pending_approval','active')
      ))`,
    )
    if (cleanWgRole === 'manager')
      where.push(
        `EXISTS (
          SELECT 1 FROM wg_progress manager_wg
          WHERE manager_wg.account_id=a.id
            AND manager_wg.wg_slug=${slot}
            AND manager_wg.status='active'
            AND manager_wg.role_in_wg IN ('contact','lead')
        )`,
      )
    if (cleanWgRole === 'participant')
      where.push(
        `NOT EXISTS (
          SELECT 1 FROM wg_progress manager_wg
          WHERE manager_wg.account_id=a.id
            AND manager_wg.wg_slug=${slot}
            AND manager_wg.status='active'
            AND manager_wg.role_in_wg IN ('contact','lead')
        )`,
      )
  }
  const fromSql = dutyManagers
    ? `accounts a
       LEFT JOIN member_profiles p ON p.account_id=a.id`
    : `member_profiles p JOIN accounts a ON a.id=p.account_id`
  const clause = `WHERE ${where.join(' AND ')}`
  const count = await pool.query(`SELECT count(*)::int AS total FROM ${fromSql} ${clause}`, values)
  total = count.rows[0]?.total || 0
  const pages = Math.max(1, Math.ceil(total / cleanPageSize))
  currentPage = Math.min(Math.max(1, cleanPage), pages)
  const limitSlot = values.length + 1
  const offsetSlot = values.length + 2
  const { rows } = await pool.query(
    `SELECT a.*, p.*,
            (SELECT COALESCE(jsonb_agg(DISTINCT ar.scope_id), '[]'::jsonb) FROM authority_records ar WHERE ar.account_id=a.id AND ar.scope_type='team' AND ar.status='active' AND ar.starts_at<=now() AND (ar.ends_at IS NULL OR ar.ends_at>now())) AS team_roles,
            ph.updated_at AS photo_updated_at,
            (ph.account_id IS NOT NULL) AS has_photo
     FROM ${fromSql}
     LEFT JOIN member_profile_photos ph ON ph.account_id=a.id
     ${clause}
     ORDER BY COALESCE(NULLIF(p.display_name,''), a.name) ASC
     LIMIT $${limitSlot} OFFSET $${offsetSlot}`,
    [...values, cleanPageSize, (currentPage - 1) * cleanPageSize],
  )
  accounts = rows.map(accountView).filter((a): a is AccountView => a !== null)
  profileRows = rows

  const maps = await relationshipMaps(accounts)
  return {
    items: accounts.map((account, index) => {
      const profile = profileShape(profileRows[index], account)
      return safePerson(profile, account, relationshipsFor(account, maps), {
        duty: dutyManagers,
        workingGroup: cleanWg,
      })
    }),
    total,
    page: currentPage,
    pageSize: cleanPageSize,
    pages: Math.max(1, Math.ceil(total / cleanPageSize)),
  }
}

export async function getMemberPerson(viewer: AccountLike, accountId: any) {
  const pool = requirePgPool()
  const { rows } = await pool.query(`SELECT * FROM accounts WHERE id=$1`, [Number(accountId)])
  const account = accountView(rows[0])
  if (!account || !account.isVerified || account.entityType !== 'individual') return null
  const row = await profileRow(account.id)
  const profile = profileShape(row, account)
  const canOverride =
    viewer.id === account.id ||
    viewer.access?.capabilities?.includes('accounts.manage') ||
    viewer.access?.teamRoles?.includes('membership_team')
  if (profile.directoryVisibility !== 'members' && !canOverride) return null
  const maps = await relationshipMaps([account])
  return safePerson(profile, account, relationshipsFor(account, maps))
}

export async function getOwnMemberProfile(account: AccountLike) {
  const profile = profileShape(await profileRow(account.id), account)
  const maps = await relationshipMaps([account])
  return {
    ...profile,
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      country: account.country || null,
      region: account.region || null,
    },
    relationships: relationshipsFor(account, maps),
  }
}
