import {
  TEAM_LABELS,
  WEBSITE_PERMISSIONS,
} from '../../shared/responsibilities.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'
import { findAccountById, publicAccount } from './accounts.js'
import { readJson, writeJson } from './jsonFile.js'
import { workingGroupLabel } from '../../shared/workingGroups.js'

const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data',
)
const profilesPath = path.join(dataDir, 'member-profiles.json')
const photosPath = path.join(dataDir, 'member-profile-photos.json')

export const MEMBER_PHOTO_MAX_BYTES = 768 * 1024
export const MEMBER_PHOTO_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

function profileShape(row, account) {
  const updatedAt = row?.updated_at ?? row?.updatedAt ?? null
  const photoUpdatedAt = row?.photo_updated_at ?? row?.photoUpdatedAt ?? null
  return {
    accountId: account.id,
    displayName:
      row?.display_name ?? row?.displayName ?? account.name ?? 'YOUNGO member',
    headline: row?.headline || '',
    bio: row?.bio || '',
    pronouns: row?.pronouns || '',
    expertiseTags: row?.expertise_tags ?? row?.expertiseTags ?? [],
    directoryVisibility:
      row?.directory_visibility ?? row?.directoryVisibility ?? 'private',
    showCountry: Boolean(row?.show_country ?? row?.showCountry),
    showOrganization: Boolean(row?.show_organization ?? row?.showOrganization),
    showWorkingGroups:
      row?.show_working_groups ?? row?.showWorkingGroups ?? true,
    showRoles: row?.show_roles ?? row?.showRoles ?? true,
    revision: row?.revision || 1,
    updatedAt,
    hasPhoto: Boolean(row?.has_photo ?? row?.hasPhoto ?? photoUpdatedAt),
    photoUpdatedAt,
    photoUrl: photoUpdatedAt
      ? `/api/member/people/${account.id}/photo?v=${encodeURIComponent(photoUpdatedAt)}`
      : null,
  }
}

function cleanText(value, max, field, fields, { required = false } = {}) {
  const text = String(value ?? '').trim()
  if (required && !text) fields[field] = 'This field is required.'
  if (text.length > max) fields[field] = `Use ${max} characters or fewer.`
  return text.slice(0, max)
}

export function validateMemberProfile(input = {}) {
  const fields = {}
  const displayName = cleanText(input.displayName, 100, 'displayName', fields)
  const headline = cleanText(input.headline, 140, 'headline', fields)
  const bio = cleanText(input.bio, 1200, 'bio', fields)
  const pronouns = cleanText(input.pronouns, 40, 'pronouns', fields)
  const rawTags = Array.isArray(input.expertiseTags)
    ? input.expertiseTags
    : String(input.expertiseTags || '').split(',')
  const expertiseTags = []
  const seen = new Set()
  for (const value of rawTags) {
    const tag = String(value || '').trim()
    const key = tag.toLocaleLowerCase()
    if (!tag || seen.has(key)) continue
    if (tag.length > 32) {
      fields.expertiseTags = 'Each tag must use 32 characters or fewer.'
      break
    }
    if (expertiseTags.length >= 8) {
      fields.expertiseTags = 'Choose no more than 8 tags.'
      break
    }
    seen.add(key)
    expertiseTags.push(tag)
  }
  const directoryVisibility = String(input.directoryVisibility || 'private')
  if (!['private', 'members'].includes(directoryVisibility))
    fields.directoryVisibility = 'Choose a valid directory visibility.'
  if (Object.keys(fields).length) {
    const error = new Error('Check the highlighted profile fields.')
    error.code = 'validation'
    error.fields = fields
    throw error
  }
  return {
    displayName: displayName || null,
    headline: headline || null,
    bio: bio || null,
    pronouns: pronouns || null,
    expertiseTags,
    directoryVisibility,
    showCountry: Boolean(input.showCountry),
    showOrganization: Boolean(input.showOrganization),
    showWorkingGroups: input.showWorkingGroups !== false,
    showRoles: input.showRoles !== false,
  }
}

async function profileRow(accountId) {
  const pool = getPool()
  if (pool) {
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
  const row = readJson(profilesPath, []).find(
    (item) => item.account_id === accountId,
  )
  const photo = readJson(photosPath, []).find(
    (item) => item.account_id === accountId,
  )
  if (!row && !photo) return null
  return {
    ...(row || { account_id: accountId }),
    has_photo: Boolean(photo),
    photo_updated_at: photo?.updated_at || null,
  }
}

async function relationshipMaps(accounts) {
  const ids = accounts.map((account) => account.id)
  const progressByAccount = new Map(ids.map((id) => [id, []]))
  const orgByAccount = new Map()
  if (!ids.length) return { progressByAccount, orgByAccount }
  const pool = getPool()
  if (pool) {
    const [progressResult, seatsResult] = await Promise.all([
      pool.query(
        `SELECT account_id, wg_slug, role_in_wg, status
         FROM wg_workspace_progress
         WHERE account_id=ANY($1::uuid[])
           AND status IN ('interested','pending_approval','active')
         ORDER BY joined_at ASC`,
        [ids],
      ),
      pool.query(
        `SELECT s.member_account_id, s.seat_role,
                COALESCE(o.organization_name, o.name) AS organization_name
         FROM ngo_seats s
         JOIN hub_accounts o ON o.id=s.org_account_id
         WHERE s.member_account_id=ANY($1::uuid[]) AND s.status='active'`,
        [ids],
      ),
    ])
    for (const row of progressResult.rows)
      progressByAccount.get(row.account_id)?.push(row)
    for (const row of seatsResult.rows)
      orgByAccount.set(row.member_account_id, {
        name: row.organization_name,
        seatRole: row.seat_role,
      })
  } else {
    for (const row of readJson(path.join(dataDir, 'wg-progress.json'), []))
      if (
        progressByAccount.has(row.account_id) &&
        ['interested', 'pending_approval', 'active'].includes(row.status)
      )
        progressByAccount.get(row.account_id).push(row)
    const accountRows = readJson(path.join(dataDir, 'hub-accounts.json'), [])
    for (const seat of readJson(path.join(dataDir, 'ngo-seats.json'), [])) {
      if (!ids.includes(seat.member_account_id) || seat.status !== 'active')
        continue
      const org = accountRows.find((item) => item.id === seat.org_account_id)
      orgByAccount.set(seat.member_account_id, {
        name: org?.organization_name || org?.name || null,
        seatRole: seat.seat_role,
      })
    }
  }
  return { progressByAccount, orgByAccount }
}

function relationshipsFor(account, maps) {
  const progress = maps.progressByAccount.get(account.id) || []
  const bySlug = new Map()
  for (const item of progress)
    bySlug.set(item.wg_slug, {
      slug: item.wg_slug,
      name: workingGroupLabel(item.wg_slug),
      role: item.role_in_wg || 'member',
      status: item.status,
    })
  for (const slug of account.wgInterests || [])
    if (!bySlug.has(slug))
      bySlug.set(slug, {
        slug,
        name: workingGroupLabel(slug),
        role: 'interested',
        status: 'interested',
      })
  return {
    workingGroups: [...bySlug.values()],
    teams: (account.teamRoles || [])
      .filter((role) => !WEBSITE_PERMISSIONS.includes(role))
      .map((slug) => ({
        slug,
        name: TEAM_LABELS[slug] || slug.replaceAll('_', ' '),
      })),
    organization: maps.orgByAccount.get(account.id) || null,
    platformRole:
      account.role && account.role !== 'member' ? account.role : null,
  }
}

function safePerson(profile, account, relationships) {
  return {
    id: account.id,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    pronouns: profile.pronouns,
    expertiseTags: profile.expertiseTags,
    country: profile.showCountry ? account.country || null : null,
    organization: profile.showOrganization ? relationships.organization : null,
    workingGroups: profile.showWorkingGroups ? relationships.workingGroups : [],
    teams: profile.showRoles ? relationships.teams : [],
    platformRole: profile.showRoles ? relationships.platformRole : null,
    photoUrl: profile.photoUrl,
    updatedAt: profile.updatedAt,
  }
}

export async function getOwnMemberProfile(account) {
  const profile = profileShape(await profileRow(account.id), account)
  const maps = await relationshipMaps([account])
  return {
    ...profile,
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      country: account.country || null,
    },
    relationships: relationshipsFor(account, maps),
  }
}

export async function listMemberProfileSummaries(accounts) {
  if (!accounts.length) return new Map()
  const pool = getPool()
  let rows
  if (pool) {
    const result = await pool.query(
      `SELECT p.*,
              ph.updated_at AS photo_updated_at,
              (ph.account_id IS NOT NULL) AS has_photo
       FROM member_profiles p
       LEFT JOIN member_profile_photos ph ON ph.account_id=p.account_id
       WHERE p.account_id=ANY($1::uuid[])`,
      [accounts.map((account) => account.id)],
    )
    rows = result.rows
  } else {
    const photos = readJson(photosPath, [])
    rows = readJson(profilesPath, []).map((profile) => ({
      ...profile,
      photo_updated_at:
        photos.find((photo) => photo.account_id === profile.account_id)
          ?.updated_at || null,
    }))
  }
  const byId = new Map(rows.map((row) => [row.account_id, row]))
  return new Map(
    accounts.map((account) => {
      const profile = profileShape(byId.get(account.id), account)
      return [
        account.id,
        {
          displayName: profile.displayName,
          headline: profile.headline,
          expertiseTags: profile.expertiseTags,
          directoryVisibility: profile.directoryVisibility,
          hasPhoto: profile.hasPhoto,
          photoUrl: profile.photoUrl,
          updatedAt: profile.updatedAt,
        },
      ]
    }),
  )
}

export async function updateOwnMemberProfile(account, input, updatedBy) {
  const value = validateMemberProfile(input)
  const now = new Date().toISOString()
  const pool = getPool()
  if (pool) {
    await pool.query(
      `INSERT INTO member_profiles (
         account_id, display_name, headline, bio, pronouns, expertise_tags,
         directory_visibility, show_country, show_organization,
         show_working_groups, show_roles, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT(account_id) DO UPDATE SET
         display_name=EXCLUDED.display_name,
         headline=EXCLUDED.headline,
         bio=EXCLUDED.bio,
         pronouns=EXCLUDED.pronouns,
         expertise_tags=EXCLUDED.expertise_tags,
         directory_visibility=EXCLUDED.directory_visibility,
         show_country=EXCLUDED.show_country,
         show_organization=EXCLUDED.show_organization,
         show_working_groups=EXCLUDED.show_working_groups,
         show_roles=EXCLUDED.show_roles,
         revision=member_profiles.revision + 1,
         updated_by=EXCLUDED.updated_by,
         updated_at=now()`,
      [
        account.id,
        value.displayName,
        value.headline,
        value.bio,
        value.pronouns,
        value.expertiseTags,
        value.directoryVisibility,
        value.showCountry,
        value.showOrganization,
        value.showWorkingGroups,
        value.showRoles,
        updatedBy || account.id,
      ],
    )
  } else {
    const rows = readJson(profilesPath, [])
    const index = rows.findIndex((item) => item.account_id === account.id)
    const current = index >= 0 ? rows[index] : null
    const row = {
      account_id: account.id,
      display_name: value.displayName,
      headline: value.headline,
      bio: value.bio,
      pronouns: value.pronouns,
      expertise_tags: value.expertiseTags,
      directory_visibility: value.directoryVisibility,
      show_country: value.showCountry,
      show_organization: value.showOrganization,
      show_working_groups: value.showWorkingGroups,
      show_roles: value.showRoles,
      revision: (current?.revision || 0) + 1,
      updated_by: updatedBy || account.id,
      created_at: current?.created_at || now,
      updated_at: now,
    }
    if (index >= 0) rows[index] = row
    else rows.push(row)
    writeJson(profilesPath, rows)
  }
  return getOwnMemberProfile(account)
}

function cleanPage(value, fallback, max) {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) ? Math.min(max, Math.max(1, number)) : fallback
}

export async function listMemberPeople({
  search = '',
  tag = '',
  workingGroup = '',
  workingGroupRole = '',
  page = 1,
  pageSize = 24,
} = {}) {
  const cleanSearch = String(search).trim().slice(0, 120)
  const cleanTag = String(tag).trim().slice(0, 32)
  const cleanWg = String(workingGroup).trim().slice(0, 80)
  const cleanWgRole = ['manager', 'participant'].includes(workingGroupRole)
    ? workingGroupRole
    : ''
  const cleanPage = Number.parseInt(page, 10) || 1
  const cleanPageSize = cleanPageNumber(pageSize)
  const pool = getPool()
  let accounts
  let profileRows
  let total
  if (pool) {
    const values = []
    const where = [
      `p.directory_visibility='members'`,
      `a.entity_type='individual'`,
      `a.member_status='verified'`,
      `a.hub_access_status='active'`,
    ]
    const add = (sql, value) => {
      values.push(value)
      where.push(sql.replaceAll('?', `$${values.length}`))
    }
    if (cleanSearch)
      add(
        `concat_ws(' ', COALESCE(NULLIF(p.display_name,''), a.name), p.headline, array_to_string(p.expertise_tags, ' ')) ILIKE ?`,
        `%${cleanSearch}%`,
      )
    if (cleanTag)
      add(
        `EXISTS (SELECT 1 FROM unnest(p.expertise_tags) t WHERE lower(t)=lower(?))`,
        cleanTag,
      )
    if (cleanWg) {
      values.push(cleanWg)
      const slot = `$${values.length}`
      where.push(
        `(${slot}=ANY(a.wg_interests) OR EXISTS (
          SELECT 1 FROM wg_workspace_progress w
          WHERE w.account_id=a.id AND w.wg_slug=${slot}
            AND w.status IN ('interested','pending_approval','active')
        ))`,
      )
      if (cleanWgRole === 'manager')
        where.push(
          `EXISTS (
            SELECT 1 FROM wg_workspace_progress manager_wg
            WHERE manager_wg.account_id=a.id
              AND manager_wg.wg_slug=${slot}
              AND manager_wg.status='active'
              AND manager_wg.role_in_wg IN ('contact','lead')
          )`,
        )
      if (cleanWgRole === 'participant')
        where.push(
          `NOT EXISTS (
            SELECT 1 FROM wg_workspace_progress manager_wg
            WHERE manager_wg.account_id=a.id
              AND manager_wg.wg_slug=${slot}
              AND manager_wg.status='active'
              AND manager_wg.role_in_wg IN ('contact','lead')
          )`,
        )
    }
    const clause = `WHERE ${where.join(' AND ')}`
    const count = await pool.query(
      `SELECT count(*)::int AS total
       FROM member_profiles p JOIN hub_accounts a ON a.id=p.account_id
       ${clause}`,
      values,
    )
    total = count.rows[0]?.total || 0
    const pages = Math.max(1, Math.ceil(total / cleanPageSize))
    const currentPage = Math.min(Math.max(1, cleanPage), pages)
    const limitSlot = values.length + 1
    const offsetSlot = values.length + 2
    const { rows } = await pool.query(
      `SELECT a.*, p.*,
              ph.updated_at AS photo_updated_at,
              (ph.account_id IS NOT NULL) AS has_photo
       FROM member_profiles p
       JOIN hub_accounts a ON a.id=p.account_id
       LEFT JOIN member_profile_photos ph ON ph.account_id=a.id
       ${clause}
       ORDER BY COALESCE(NULLIF(p.display_name,''), a.name) ASC
       LIMIT $${limitSlot} OFFSET $${offsetSlot}`,
      [...values, cleanPageSize, (currentPage - 1) * cleanPageSize],
    )
    accounts = rows.map(publicAccount)
    profileRows = rows
    page = currentPage
  } else {
    const profileList = readJson(profilesPath, []).filter(
      (item) => item.directory_visibility === 'members',
    )
    const accountRows = readJson(path.join(dataDir, 'hub-accounts.json'), [])
    const photoRows = readJson(photosPath, [])
    const candidates = profileList
      .map((profile) => {
        const row = accountRows.find((item) => item.id === profile.account_id)
        return row
          ? {
              account: publicAccount(row),
              profile: {
                ...profile,
                photo_updated_at:
                  photoRows.find((item) => item.account_id === row.id)
                    ?.updated_at || null,
              },
            }
          : null
      })
      .filter(
        (item) =>
          item?.account.entityType === 'individual' && item.account.isVerified,
      )
    const maps = await relationshipMaps(candidates.map((item) => item.account))
    const needle = cleanSearch.toLocaleLowerCase()
    const filtered = candidates.filter(({ account, profile }) => {
      const shaped = profileShape(profile, account)
      const relations = relationshipsFor(account, maps)
      const groupConnection = relations.workingGroups.find(
        (item) => item.slug === cleanWg,
      )
      const isManager =
        groupConnection?.status === 'active' &&
        ['contact', 'lead'].includes(groupConnection.role)
      return (
        (!needle ||
          [shaped.displayName, shaped.headline, ...shaped.expertiseTags]
            .join(' ')
            .toLocaleLowerCase()
            .includes(needle)) &&
        (!cleanTag ||
          shaped.expertiseTags.some(
            (value) =>
              value.toLocaleLowerCase() === cleanTag.toLocaleLowerCase(),
          )) &&
        (!cleanWg || Boolean(groupConnection)) &&
        (!cleanWgRole || (cleanWgRole === 'manager' ? isManager : !isManager))
      )
    })
    total = filtered.length
    const pages = Math.max(1, Math.ceil(total / cleanPageSize))
    page = Math.min(Math.max(1, cleanPage), pages)
    const selected = filtered.slice(
      (page - 1) * cleanPageSize,
      page * cleanPageSize,
    )
    accounts = selected.map((item) => item.account)
    profileRows = selected.map((item) => item.profile)
  }
  const maps = await relationshipMaps(accounts)
  return {
    items: accounts.map((account, index) => {
      const profile = profileShape(profileRows[index], account)
      return safePerson(profile, account, relationshipsFor(account, maps))
    }),
    total,
    page,
    pageSize: cleanPageSize,
    pages: Math.max(1, Math.ceil(total / cleanPageSize)),
  }
}

function cleanPageNumber(value) {
  return cleanPage(value, 24, 50)
}

export async function getMemberPerson(viewer, accountId) {
  const accountRow = await findAccountById(accountId)
  const account = publicAccount(accountRow)
  if (!account || !account.isVerified || account.entityType !== 'individual')
    return null
  const row = await profileRow(account.id)
  const profile = profileShape(row, account)
  const canOverride =
    viewer.id === account.id ||
    viewer.role === 'admin' ||
    viewer.access?.teamRoles?.includes('membership_team')
  if (profile.directoryVisibility !== 'members' && !canOverride) return null
  const maps = await relationshipMaps([account])
  return safePerson(profile, account, relationshipsFor(account, maps))
}

export function validatePhoto(bytes, contentType) {
  const type = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (!MEMBER_PHOTO_TYPES.has(type)) {
    const error = new Error('Use a JPEG, PNG, or WebP image.')
    error.code = 'validation'
    throw error
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    const error = new Error('Choose an image to upload.')
    error.code = 'validation'
    throw error
  }
  if (bytes.length > MEMBER_PHOTO_MAX_BYTES) {
    const error = new Error('Profile photos must be 768 KB or smaller.')
    error.code = 'payload_too_large'
    throw error
  }
  const signatureOk =
    (type === 'image/jpeg' &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (type === 'image/png' &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (type === 'image/webp' &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP')
  if (!signatureOk) {
    const error = new Error('The uploaded file does not match its image type.')
    error.code = 'validation'
    throw error
  }
  return type
}

export async function saveMemberPhoto(accountId, bytes, contentType, actorId) {
  const type = validatePhoto(bytes, contentType)
  const now = new Date().toISOString()
  const pool = getPool()
  if (pool) {
    await pool.query(
      `INSERT INTO member_profiles(account_id, updated_by)
       VALUES($1,$2) ON CONFLICT(account_id) DO NOTHING`,
      [accountId, actorId || accountId],
    )
    const { rows } = await pool.query(
      `INSERT INTO member_profile_photos(account_id, content_type, bytes, byte_size, updated_by)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(account_id) DO UPDATE SET
         content_type=EXCLUDED.content_type,
         bytes=EXCLUDED.bytes,
         byte_size=EXCLUDED.byte_size,
         revision=member_profile_photos.revision + 1,
         updated_by=EXCLUDED.updated_by,
         updated_at=now()
       RETURNING content_type, byte_size, revision, updated_at`,
      [accountId, type, bytes, bytes.length, actorId || accountId],
    )
    return rows[0]
  }
  const rows = readJson(photosPath, [])
  const index = rows.findIndex((item) => item.account_id === accountId)
  const current = index >= 0 ? rows[index] : null
  const row = {
    account_id: accountId,
    content_type: type,
    bytes_base64: bytes.toString('base64'),
    byte_size: bytes.length,
    revision: (current?.revision || 0) + 1,
    updated_by: actorId || accountId,
    updated_at: now,
  }
  if (index >= 0) rows[index] = row
  else rows.push(row)
  writeJson(photosPath, rows)
  const profiles = readJson(profilesPath, [])
  if (!profiles.some((profile) => profile.account_id === accountId)) {
    profiles.push({
      account_id: accountId,
      directory_visibility: 'private',
      expertise_tags: [],
      show_country: false,
      show_organization: false,
      show_working_groups: true,
      show_roles: true,
      revision: 1,
      updated_by: actorId || accountId,
      created_at: now,
      updated_at: now,
    })
    writeJson(profilesPath, profiles)
  }
  return row
}

export async function readMemberPhoto(accountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT content_type, bytes, byte_size, revision, updated_at
       FROM member_profile_photos WHERE account_id=$1`,
      [accountId],
    )
    return rows[0] || null
  }
  const row = readJson(photosPath, []).find(
    (item) => item.account_id === accountId,
  )
  return row ? { ...row, bytes: Buffer.from(row.bytes_base64, 'base64') } : null
}

export async function deleteMemberPhoto(accountId) {
  const pool = getPool()
  if (pool) {
    const result = await pool.query(
      'DELETE FROM member_profile_photos WHERE account_id=$1',
      [accountId],
    )
    return result.rowCount > 0
  }
  const rows = readJson(photosPath, [])
  const kept = rows.filter((item) => item.account_id !== accountId)
  if (kept.length === rows.length) return false
  writeJson(photosPath, kept)
  return true
}
