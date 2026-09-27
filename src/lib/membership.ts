// Membership files: profile photos + identity appeal proofs (bytea tables —
// never the public media store), plus the membership-team review shapes.
// Ported from server/lib/memberProfiles.js, membershipAppeals.js and
// membershipReview.js.
import { type Pool } from 'pg'
import { requirePgPool, getPgPool } from './pg'
import { accountView } from './accounts'
import { sendEmail } from './email'
import { appBaseUrl } from './env'

export function membershipError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code })
}

// ── Profile photos ──────────────────────────────────────────────────────────

const MEMBER_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MEMBER_PHOTO_MAX_BYTES = 768 * 1024

export function validateMemberPhoto(bytes: Buffer, contentType: string) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase()
  if (!MEMBER_PHOTO_TYPES.has(type))
    throw membershipError(400, 'validation', 'Use a JPEG, PNG, or WebP image.')
  if (!Buffer.isBuffer(bytes) || bytes.length === 0)
    throw membershipError(400, 'validation', 'Choose an image to upload.')
  if (bytes.length > MEMBER_PHOTO_MAX_BYTES)
    throw membershipError(
      413,
      'payload_too_large',
      'Profile photos must be 768 KB or smaller.',
    )
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
  if (!signatureOk)
    throw membershipError(
      400,
      'validation',
      'The uploaded file does not match its image type.',
    )
  return type
}

export async function saveMemberPhoto(
  accountId: number,
  bytes: Buffer,
  contentType: string,
  actorId?: number,
) {
  const type = validateMemberPhoto(bytes, contentType)
  const pool = requirePgPool()
  await pool.query(
    `INSERT INTO member_profiles(account_id, display_name, created_at, updated_at)
     VALUES($1,'',now(),now()) ON CONFLICT(account_id) DO NOTHING`,
    [accountId],
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

export async function readMemberPhoto(accountId: number, pool?: Pool | null) {
  const db = pool || getPgPool()
  if (!db) return null
  const { rows } = await db.query(
    `SELECT content_type, bytes, byte_size, revision, updated_at
     FROM member_profile_photos WHERE account_id=$1`,
    [accountId],
  )
  return rows[0] || null
}

export async function deleteMemberPhoto(accountId: number) {
  const pool = requirePgPool()
  const result = await pool.query(
    'DELETE FROM member_profile_photos WHERE account_id=$1',
    [accountId],
  )
  return (result.rowCount || 0) > 0
}

// ── Membership appeals ──────────────────────────────────────────────────────

export const APPEAL_IDENTITY_KINDS = [
  'passport',
  'national_id',
  'organisational_letter',
  'other',
]
export const APPEAL_PROOF_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])
export const APPEAL_PROOF_MAX_BYTES = 2 * 1024 * 1024
export const APPEAL_MAX_PER_ACCOUNT = 3

const pick = (row: any, snake: string, camel: string, fallback: any = null) => {
  const value = row?.[snake] ?? row?.[camel]
  return value == null ? fallback : value
}

export function publicAppeal(
  row: any,
  { includeStatement = true } = {},
): any {
  if (!row) return null
  return {
    id: row.id,
    accountId: pick(row, 'account_id', 'accountId'),
    status: row.status,
    identityKind: pick(row, 'identity_kind', 'identityKind'),
    statement: includeStatement ? pick(row, 'statement', 'statement') : null,
    proofContentType: pick(row, 'proof_content_type', 'proofContentType'),
    proofByteSize: Number(pick(row, 'proof_byte_size', 'proofByteSize') || 0),
    submittedAt: pick(row, 'created_at', 'createdAt'),
    reviewedAt: pick(row, 'reviewed_at', 'reviewedAt'),
    reviewerNote: pick(row, 'review_note', 'reviewerNote'),
  }
}

export function validateAppealProof(bytes: Buffer, contentType: string) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase()
  if (!APPEAL_PROOF_TYPES.has(type))
    throw membershipError(
      400,
      'validation',
      'Upload a JPEG, PNG, WebP, or PDF of the identity document.',
    )
  if (!Buffer.isBuffer(bytes) || bytes.length === 0)
    throw membershipError(400, 'validation', 'Choose a document to upload.')
  if (bytes.length > APPEAL_PROOF_MAX_BYTES)
    throw membershipError(
      413,
      'payload_too_large',
      'Identity documents must be 2 MB or smaller.',
    )
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
      bytes.subarray(8, 12).toString('ascii') === 'WEBP') ||
    (type === 'application/pdf' &&
      bytes.subarray(0, 4).toString('ascii') === '%PDF')
  if (!signatureOk)
    throw membershipError(
      400,
      'validation',
      'The uploaded file does not match its document type.',
    )
  return type
}

function validateAppealInput({
  account,
  statement,
  identityKind,
  bytes,
  contentType,
}: {
  account: any
  statement: string
  identityKind: string
  bytes: Buffer
  contentType: string
}) {
  if (account?.membershipStatus !== 'rejected')
    throw membershipError(
      403,
      'forbidden',
      'Only a rejected application can send an identity appeal.',
    )
  const kind = String(identityKind || '').trim()
  if (!APPEAL_IDENTITY_KINDS.includes(kind))
    throw membershipError(
      400,
      'validation',
      'Choose what kind of identity proof this is.',
    )
  const text = String(statement || '').trim()
  if (text.length < 40)
    throw membershipError(
      400,
      'validation',
      'Explain who you are in at least 40 characters.',
    )
  if (text.length > 2000)
    throw membershipError(
      400,
      'validation',
      'Keep the appeal under 2000 characters.',
    )
  const type = validateAppealProof(bytes, contentType)
  return { kind, text, type }
}

const APPEAL_COLUMNS = `id, account_id, status, identity_kind, statement,
  proof_content_type, proof_byte_size, review_note, created_at, reviewed_at`

export async function getOwnAppeal(accountId: number, pool?: Pool | null) {
  const db = pool || getPgPool()
  if (!db) return null
  const { rows } = await db.query(
    `SELECT ${APPEAL_COLUMNS} FROM membership_appeals
     WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [accountId],
  )
  return publicAppeal(rows[0])
}

export async function listLatestAppealsForAccounts(
  accountIds: (number | string)[],
  pool?: Pool | null,
) {
  const ids = [...new Set((accountIds || []).filter(Boolean))]
  const map = new Map()
  if (!ids.length) return map
  const db = pool || getPgPool()
  if (!db) return map
  const { rows } = await db.query(
    `SELECT DISTINCT ON (account_id) ${APPEAL_COLUMNS}
     FROM membership_appeals
     WHERE account_id = ANY($1::int[])
     ORDER BY account_id, created_at DESC`,
    [ids],
  )
  for (const row of rows) map.set(row.account_id, publicAppeal(row))
  return map
}

export async function submitAppeal({
  account,
  statement,
  identityKind,
  bytes,
  contentType,
}: {
  account: any
  statement: string
  identityKind: string
  bytes: Buffer
  contentType: string
}) {
  const { kind, text, type } = validateAppealInput({
    account,
    statement,
    identityKind,
    bytes,
    contentType,
  })
  const pool = requirePgPool()
  const count = await pool.query(
    'SELECT count(*)::int AS total FROM membership_appeals WHERE account_id=$1',
    [account.id],
  )
  if ((count.rows[0]?.total || 0) >= APPEAL_MAX_PER_ACCOUNT)
    throw membershipError(
      409,
      'appeal_limit',
      'This application has already used its three identity appeals.',
    )
  const existing = await getOwnAppeal(account.id, pool)
  if (existing?.status === 'submitted')
    throw membershipError(
      409,
      'appeal_open',
      'An identity appeal is already waiting for the Membership Team.',
    )
  try {
    const { rows } = await pool.query(
      `INSERT INTO membership_appeals (
         account_id, status, identity_kind, statement,
         proof_content_type, proof_bytes, proof_byte_size,
         review_note, created_at, updated_at
       ) VALUES ($1,'submitted',$2,$3,$4,$5,$6,'',now(),now())
       RETURNING ${APPEAL_COLUMNS}`,
      [account.id, kind, text, type, bytes, bytes.length],
    )
    return publicAppeal(rows[0])
  } catch (error: any) {
    if (error.code === '23505')
      throw membershipError(
        409,
        'appeal_open',
        'An identity appeal is already waiting for the Membership Team.',
      )
    throw error
  }
}

export async function readAppealProof(id: string | number, pool?: Pool | null) {
  const db = pool || getPgPool()
  if (!db) return null
  const { rows } = await db.query(
    `SELECT id, account_id, proof_content_type, proof_bytes, proof_byte_size
     FROM membership_appeals WHERE id=$1`,
    [id],
  )
  return rows[0] || null
}

export async function findAppealById(id: string | number, pool?: Pool | null) {
  const db = pool || getPgPool()
  if (!db) return null
  const { rows } = await db.query(
    `SELECT ${APPEAL_COLUMNS} FROM membership_appeals WHERE id=$1`,
    [id],
  )
  return rows[0] || null
}

export async function reviewAppeal({
  id,
  decision,
  note,
  reviewerId,
}: {
  id: string | number
  decision: string
  note: string
  reviewerId: number
}) {
  const next =
    decision === 'grant' ? 'granted' : decision === 'uphold' ? 'upheld' : null
  if (!next)
    throw membershipError(400, 'validation', 'Choose grant or uphold.')
  const reason = String(note || '').trim()
  if (reason.length < 8)
    throw membershipError(
      400,
      'validation',
      'Give a review note of at least 8 characters.',
    )
  const existing = await findAppealById(id)
  if (!existing) return null
  if (existing.status !== 'submitted')
    throw membershipError(
      409,
      'already_reviewed',
      'This appeal has already been reviewed.',
    )
  const pool = requirePgPool()
  const { rows } = await pool.query(
    `UPDATE membership_appeals
     SET status=$2, reviewed_by_id=$3, review_note=$4, reviewed_at=now(), updated_at=now()
     WHERE id=$1 AND status='submitted'
     RETURNING ${APPEAL_COLUMNS}`,
    [id, next, reviewerId, reason.slice(0, 500)],
  )
  return rows[0] ? publicAppeal(rows[0]) : null
}

// ── Membership review shapes ────────────────────────────────────────────────

const REVIEW_COLUMNS = `
  id, email, name, first_name, last_name, phone, gender, gender_other,
  entity_type, membership_track, country, date_of_birth, nationality, region, age_band,
  organization_name, organization_type, is_unfccc_admitted,
  youth_affiliation, member_of_accredited_ngo,
  motivation, wg_interests, org_operate_in, org_website, org_social, org_mission,
  dcp_name, dcp_email, dcp_phone, ycp_name, ycp_email, ycp_phone,
  under18, guardian_name, guardian_email, guardian_consent,
  minority_groups, minority_other,
  accept_code_of_conduct, accept_data_protection, accept_principles, accept_coi_policy,
  policies_accepted, membership_policy_version,
  privacy_consent, privacy_notice_version, privacy_consent_at,
  coi_declared, coi_details,
  member_status, role, team_roles, course_passed_at, course_score, verified_at,
  constituency_work_status, hub_access_status, membership_status,
  onboarding_cohort, renewal_due_at, membership_ended_at, membership_end_reason,
  created_at, last_login_at, email_verified_at, verified_by
`

function textList(value: any): string[] {
  if (Array.isArray(value))
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function pickDate(row: any, snake: string, camel: string) {
  const value = row?.[snake] ?? row?.[camel]
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear()
    const month = String(value.getUTCMonth() + 1).padStart(2, '0')
    const day = String(value.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : text || null
}

function pickBool(row: any, snake: string, camel: string) {
  const value = row?.[snake] ?? row?.[camel]
  if (value === true || value === 'yes' || value === 'true') return true
  if (value === false || value === 'no' || value === 'false') return false
  return null
}

export function extractPublicLinks(...values: any[]) {
  const found: { href: string; host: string }[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const text = String(value || '')
    if (!text.trim()) continue
    const tokens = text.split(/[\s,;|]+/).filter(Boolean)
    const embedded = text.match(/https?:\/\/[^\s<>"'()]+/gi) || []
    for (const raw of [...tokens, ...embedded]) {
      const trimmed = String(raw || '')
        .trim()
        .replace(/[).,;:]+$/g, '')
      if (!trimmed) continue
      let href = trimmed
      if (!/^https?:\/\//i.test(href)) {
        if (!/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(href)) continue
        href = `https://${href}`
      }
      try {
        const url = new URL(href)
        if (!['http:', 'https:'].includes(url.protocol)) continue
        if (!url.hostname.includes('.')) continue
        const normalized = url.toString()
        if (seen.has(normalized)) continue
        seen.add(normalized)
        found.push({
          href: normalized,
          host: url.hostname.replace(/^www\./, ''),
        })
      } catch {
        // Ignore tokens that are not URLs.
      }
    }
  }
  return found
}

export function membershipReviewAccount(row: any) {
  const account = accountView(row)
  if (!account) return null
  const orgWebsite = pick(row, 'org_website', 'orgWebsite')
  const orgSocial = pick(row, 'org_social', 'orgSocial')
  const under18 = Boolean(row.under_18 ?? row.under18)
  const minorityGroups = textList(row.minority_groups ?? row.minorityGroups)
  const minorityOther = pick(row, 'minority_other', 'minorityOther')
  return {
    ...account,
    application: {
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      phone: account.phone,
      gender: account.gender,
      genderOther: pick(row, 'gender_other', 'genderOther'),
      dateOfBirth: pickDate(row, 'date_of_birth', 'dateOfBirth'),
      ageBand: account.ageBand,
      entityType: account.entityType,
      membershipTrack: account.membershipTrack,
      countryOfResidence: account.country,
      region: account.region,
      nationality: account.nationality,
      motivation: pick(row, 'motivation', 'motivation'),
      minorityIdentity: minorityGroups.length || minorityOther ? true : false,
      minorityGroups,
      minorityOther,
      memberOfAccreditedNgo: pickBool(
        row,
        'member_of_accredited_ngo',
        'memberOfAccreditedNgo',
      ),
      organizationName: account.organizationName,
      organizationType: account.organizationType,
      isUnfcccAdmitted: account.isUnfcccAdmitted,
      youthAffiliation: account.youthAffiliation,
      orgWebsite,
      orgSocial,
      orgMission: pick(row, 'org_mission', 'orgMission'),
      orgOperateIn: pick(row, 'org_operate_in', 'orgOperateIn'),
      under18,
      guardianName: under18 ? pick(row, 'guardian_name', 'guardianName') : null,
      guardianEmail: under18
        ? pick(row, 'guardian_email', 'guardianEmail')
        : null,
      guardianConsent: under18
        ? pickBool(row, 'guardian_consent', 'guardianConsent')
        : null,
      dcpName: pick(row, 'dcp_name', 'dcpName'),
      dcpEmail: pick(row, 'dcp_email', 'dcpEmail'),
      dcpPhone: pick(row, 'dcp_phone', 'dcpPhone'),
      ycpName: pick(row, 'ycp_name', 'ycpName'),
      ycpEmail: pick(row, 'ycp_email', 'ycpEmail'),
      ycpPhone: pick(row, 'ycp_phone', 'ycpPhone'),
      acceptCodeOfConduct: pickBool(
        row,
        'accept_code_of_conduct',
        'acceptCodeOfConduct',
      ),
      acceptDataProtection: pickBool(
        row,
        'accept_data_protection',
        'acceptDataProtection',
      ),
      acceptPrinciples: pickBool(row, 'accept_principles', 'acceptPrinciples'),
      acceptCoiPolicy: pickBool(row, 'accept_coi_policy', 'acceptCoiPolicy'),
      policiesAccepted: pickBool(row, 'policies_accepted', 'policiesAccepted'),
      membershipPolicyVersion: account.membershipPolicyVersion || null,
      privacyConsent: pickBool(row, 'privacy_consent', 'privacyConsent'),
      privacyNoticeVersion: account.privacyNoticeVersion,
      privacyConsentAt: account.privacyConsentAt,
      coiDeclared: pickBool(row, 'coi_declared', 'coiDeclared'),
      coiDetails: pick(row, 'coi_details', 'coiDetails'),
      links: extractPublicLinks(orgWebsite, orgSocial),
    },
  }
}

export async function listMembershipReviewItems() {
  const pool = requirePgPool()
  const { rows } = await pool.query(
    `SELECT ${REVIEW_COLUMNS}
     FROM accounts
     ORDER BY created_at DESC
     LIMIT 500`,
  )
  return rows.map(membershipReviewAccount)
}

function profileShape(row: any, account: any) {
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
    roleTitle: row?.role_title ?? row?.roleTitle ?? '',
    revision: row?.revision || 1,
    updatedAt,
    hasPhoto: Boolean(row?.has_photo ?? row?.hasPhoto ?? photoUpdatedAt),
    photoUpdatedAt,
    photoUrl: photoUpdatedAt
      ? `/api/member/people/${account.id}/photo?v=${encodeURIComponent(photoUpdatedAt)}`
      : null,
  }
}

export async function listMemberProfileSummaries(accounts: any[]) {
  const byAccountId = new Map<number, any>()
  if (!accounts.length) return byAccountId
  const pool = getPgPool()
  let rows: any[] = []
  if (pool) {
    const result = await pool.query(
      `SELECT p.*,
              ph.updated_at AS photo_updated_at,
              (ph.account_id IS NOT NULL) AS has_photo
       FROM member_profiles p
       LEFT JOIN member_profile_photos ph ON ph.account_id=p.account_id
       WHERE p.account_id=ANY($1::int[])`,
      [accounts.map((account) => account.id)],
    )
    rows = result.rows
  }
  const byId = new Map(rows.map((row) => [row.account_id, row]))
  for (const account of accounts) {
    const profile = profileShape(byId.get(account.id), account)
    byAccountId.set(account.id, {
      displayName: profile.displayName,
      headline: profile.headline,
      expertiseTags: profile.expertiseTags,
      directoryVisibility: profile.directoryVisibility,
      hasPhoto: profile.hasPhoto,
      photoUrl: profile.photoUrl,
      updatedAt: profile.updatedAt,
    })
  }
  return byAccountId
}

export { profileShape }

// ── Member directory ─────────────────────────────────────────────
// Port of server/lib/memberProfiles.js people listing / safePerson.

const WORKING_GROUP_NAMES: Record<string, string> = {
  ace: 'ACE',
  ach: 'Arts, Culture and Heritage',
  finance: 'Finance & Markets',
  adaptation: 'Adaptation',
  'loss-and-damage': 'Loss & Damage',
  health: 'Health',
  energy: 'Energy',
  mitigation: 'Mitigation',
  ndcs: 'NDCs',
  oceans: 'Oceans',
  agriculture: 'Food & Agriculture',
  nature: 'Nature',
  water: 'Water',
  gender: 'Women & Gender',
  'human-rights': 'Human Rights',
  'child-rights': 'Child Rights',
  'peace-and-security': 'Peace & Security',
  migration: 'Migration',
  cities: 'Cities',
  'just-transition': 'Just Transition',
  science: 'Science',
  technology: 'Technology',
  'conflict-of-interest': 'Conflict of Interest',
  coy: 'Conference of Youth',
}

const workingGroupLabel = (slug: string) =>
  slug ? WORKING_GROUP_NAMES[slug] || String(slug) : ''

const TEAM_LABELS: Record<string, string> = {
  membership_team: 'GCT · Membership',
  partnerships: 'GCT · Partnerships',
  gys_policy_team: 'Global Youth Statement Policy Team',
  content_editor: 'Website access · Draft content',
  content_publisher: 'Website access · Review and publish',
}
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

async function relationshipMaps(accounts: any[]) {
  const ids = accounts.map((account) => account.id)
  const progressByAccount = new Map<number, any[]>(ids.map((id) => [id, []]))
  const orgByAccount = new Map<number, any>()
  if (!ids.length) return { progressByAccount, orgByAccount }
  const pool = getPgPool()
  if (!pool) return { progressByAccount, orgByAccount }
  const [progressResult, seatsResult] = await Promise.all([
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
  ])
  for (const row of progressResult.rows)
    progressByAccount.get(row.account_id)?.push(row)
  for (const row of seatsResult.rows)
    orgByAccount.set(row.member_account_id, {
      name: row.organization_name,
      seatRole: row.seat_role,
    })
  return { progressByAccount, orgByAccount }
}

function relationshipsFor(account: any, maps: any) {
  const progress = maps.progressByAccount.get(account.id) || []
  const bySlug = new Map<string, any>()
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
      .filter((role: string) => !WEBSITE_PERMISSIONS.includes(role))
      .map((slug: string) => ({
        slug,
        name: TEAM_LABELS[slug] || slug.replaceAll('_', ' '),
      })),
    organization: maps.orgByAccount.get(account.id) || null,
    platformRole:
      account.role && account.role !== 'member' ? account.role : null,
  }
}

function safePerson(
  profile: any,
  account: any,
  relationships: any,
  { duty = false, workingGroup = '' } = {},
) {
  const group = workingGroup
    ? relationships.workingGroups.find((item: any) => item.slug === workingGroup)
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
    organization:
      duty || profile.showOrganization ? relationships.organization : null,
    workingGroups:
      duty || profile.showWorkingGroups ? relationships.workingGroups : [],
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
  const cleanWgRole = ['manager', 'participant'].includes(workingGroupRole)
    ? workingGroupRole
    : ''
  const cleanPage = Number.parseInt(page, 10) || 1
  const cleanPageSize = cleanPageNumber(pageSize)
  const dutyManagers = cleanWgRole === 'manager' && Boolean(cleanWg)
  const pool = requirePgPool()
  let currentPage = cleanPage
  let total = 0
  let accounts: any[] = []
  let profileRows: any[] = []

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
    add(
      `EXISTS (SELECT 1 FROM unnest(p.expertise_tags) t WHERE lower(t)=lower(?))`,
      cleanTag,
    )
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
  const count = await pool.query(
    `SELECT count(*)::int AS total FROM ${fromSql} ${clause}`,
    values,
  )
  total = count.rows[0]?.total || 0
  const pages = Math.max(1, Math.ceil(total / cleanPageSize))
  currentPage = Math.min(Math.max(1, cleanPage), pages)
  const limitSlot = values.length + 1
  const offsetSlot = values.length + 2
  const { rows } = await pool.query(
    `SELECT a.*, p.*,
            ph.updated_at AS photo_updated_at,
            (ph.account_id IS NOT NULL) AS has_photo
     FROM ${fromSql}
     LEFT JOIN member_profile_photos ph ON ph.account_id=a.id
     ${clause}
     ORDER BY COALESCE(NULLIF(p.display_name,''), a.name) ASC
     LIMIT $${limitSlot} OFFSET $${offsetSlot}`,
    [...values, cleanPageSize, (currentPage - 1) * cleanPageSize],
  )
  accounts = rows.map(accountView)
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

export async function getMemberPerson(viewer: any, accountId: any) {
  const pool = requirePgPool()
  const { rows } = await pool.query(`SELECT * FROM accounts WHERE id=$1`, [
    Number(accountId),
  ])
  const account = accountView(rows[0])
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

export async function getOwnMemberProfile(account: any) {
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

// ── Membership lifecycle (staff actions) ────────────────────────────────────
// Port of server/routes/member/guards.js updateMembershipLifecycle +
// server/lib/accounts.js setAccountFields/destroyAllSessions.

export const MEMBERSHIP_STATUSES = [
  'registered',
  'course_passed',
  'awaiting_onboarding',
  'active',
  'renewal_due',
  'expired',
  'terminated',
  'rejected',
]
export const CLOSED_MEMBERSHIP_STATUSES = ['expired', 'terminated']
export const ENDED_MEMBERSHIP_STATUSES = [
  ...CLOSED_MEMBERSHIP_STATUSES,
  'rejected',
]

const ACCOUNT_FIELD_COLUMNS = new Set([
  'member_status',
  'hub_access_status',
  'membership_status',
  'constituency_work_status',
  'onboarding_cohort',
  'renewal_due_at',
  'membership_ended_at',
  'membership_end_reason',
  'verified_at',
  'verified_by',
  'role',
  'team_roles',
  'email_verified_at',
  'course_passed_at',
  'course_score',
])

export async function findAccountRowById(id: number | string) {
  const pool = requirePgPool()
  const { rows } = await pool.query(`SELECT * FROM accounts WHERE id=$1`, [
    Number(id),
  ])
  return rows[0] || null
}

export async function setAccountFields(
  id: number | string,
  fields: Record<string, any>,
) {
  const pool = requirePgPool()
  const keys = Object.keys(fields).filter((key) =>
    ACCOUNT_FIELD_COLUMNS.has(key),
  )
  if (!keys.length) return findAccountRowById(id)
  const sets = keys.map((key, i) => `${key}=$${i + 2}`).join(', ')
  const { rows } = await pool.query(
    `UPDATE accounts SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`,
    [Number(id), ...keys.map((key) => fields[key])],
  )
  return rows[0] || null
}

export async function destroyAllSessions(accountId: number | string) {
  const pool = requirePgPool()
  await pool.query(`DELETE FROM accounts_sessions WHERE _parent_id=$1`, [
    Number(accountId),
  ])
}

export async function sendMembershipActivatedEmail(account: any) {
  if (!account?.email) return { sent: false, reason: 'missing_recipient' }
  const firstName =
    String(account.firstName || account.first_name || account.name || '')
      .trim()
      .split(/\s+/)[0] || 'there'
  const origin = appBaseUrl()
  try {
    const { delivered } = await sendEmail({
      to: account.email,
      subject: 'Your YOUNGO Hub membership is active',
      text: `Hi ${firstName},\n\nYour YOUNGO Hub membership is now active. Sign in at ${origin}/ to get started.\n\n— YOUNGO Hub`,
    })
    return { sent: delivered }
  } catch (error) {
    return { sent: false, reason: 'send_failed' }
  }
}

export async function updateMembershipLifecycle({
  actor,
  targetId,
  body,
}: {
  actor: any
  targetId: number | string
  body: any
}) {
  const status = String(body?.status || body?.membershipStatus || '')
  if (!MEMBERSHIP_STATUSES.includes(status))
    throw membershipError(400, 'validation', 'Invalid membership status.')
  const beforeRow = await findAccountRowById(targetId)
  if (!beforeRow) throw membershipError(404, 'not_found', 'Account not found.')
  const before = accountView(beforeRow)!
  if (actor.role !== 'admin' && ['admin', 'focal_point'].includes(before.role))
    throw membershipError(
      403,
      'forbidden',
      'Only an admin can change platform staff membership.',
    )
  if (actor.id === before.id && ENDED_MEMBERSHIP_STATUSES.includes(status))
    throw membershipError(
      400,
      'self_suspend',
      'You cannot suspend your own admin account.',
    )
  if (
    status === 'active' &&
    !before.coursePassedAt &&
    !['admin', 'focal_point'].includes(before.role)
  )
    throw membershipError(
      409,
      'course_required',
      'The member must pass the membership course before activation.',
    )
  const reason = String(body?.reason || '').trim()
  if (status === 'terminated' && !reason)
    throw membershipError(
      400,
      'validation',
      'A reason is required when terminating membership.',
    )
  if (status === 'rejected' && !reason)
    throw membershipError(
      400,
      'validation',
      'A reason is required when rejecting an application.',
    )
  if (body?.renewalDueAt && Number.isNaN(Date.parse(body.renewalDueAt)))
    throw membershipError(400, 'validation', 'Invalid renewal date.')

  const now = new Date().toISOString()
  const closed = CLOSED_MEMBERSHIP_STATUSES.includes(status)
  const ended = ENDED_MEMBERSHIP_STATUSES.includes(status)
  const accessStatus = closed
    ? 'suspended'
    : status === 'rejected'
      ? 'pending_course'
      : [
            'course_passed',
            'awaiting_onboarding',
            'active',
            'renewal_due',
          ].includes(status)
        ? 'active'
        : 'pending_course'
  const becameActive =
    status === 'active' && before.membershipStatus !== 'active'
  const updatedRow = await setAccountFields(targetId, {
    membership_status: status,
    hub_access_status: accessStatus,
    ...(status === 'active'
      ? { member_status: 'verified', verified_at: before.verifiedAt || now }
      : {}),
    onboarding_cohort:
      body?.onboardingCohort || before.onboardingCohort || null,
    renewal_due_at: body?.renewalDueAt || before.renewalDueAt || null,
    membership_ended_at: ended ? now : null,
    membership_end_reason: ended ? reason.slice(0, 500) || null : null,
    constituency_work_status:
      status === 'active'
        ? 'active'
        : status === 'awaiting_onboarding'
          ? 'pending_onboarding'
          : before.constituencyWorkStatus,
  })
  const updated = accountView(updatedRow)
  if (accessStatus === 'suspended' || status === 'rejected')
    await destroyAllSessions(targetId)
  let emailSent: boolean | null = null
  if (becameActive) {
    const mail = await sendMembershipActivatedEmail(updated)
    emailSent = mail.sent
  }
  return { before, updated, reason: reason || null, emailSent }
}

// ── Admin account surface ────────────────────────────────────────────────────
// Ports of server/lib/lifecycle.js queryAccountsForAdmin/listAccountsForAdmin
// and server/lib/access.js setTeamAssignment / ensureOwnerSeat.

const ACCOUNT_SORTS: Record<string, string> = {
  newest: 'created_at DESC',
  oldest: 'created_at ASC',
  name: 'name ASC, email ASC',
  recent_login: 'last_login_at DESC NULLS LAST, created_at DESC',
}

const ADMIN_COLUMNS = `id, email, name, first_name, last_name, entity_type,
  organization_name, organization_type, is_unfccc_admitted, member_status, role,
  team_roles, region, country, nationality, wg_interests, course_passed_at,
  course_score, verified_at, membership_track, constituency_work_status,
  hub_access_status, membership_status, onboarding_cohort, renewal_due_at,
  membership_ended_at, membership_end_reason, created_at, last_login_at, phone,
  email_verified_at`

export async function listAccountsForAdmin() {
  const pool = requirePgPool()
  const { rows } = await pool.query(
    `SELECT ${ADMIN_COLUMNS} FROM accounts ORDER BY created_at DESC LIMIT 500`,
  )
  return rows.map(accountView)
}

export async function queryAccountsForAdmin({
  search = '',
  entityType = '',
  status = '',
  role = '',
  sort = 'newest',
  page = 1,
  pageSize = 12,
}: any = {}) {
  const cleanSearch = String(search).trim().slice(0, 120)
  const cleanEntityType = ['individual', 'organization'].includes(entityType)
    ? entityType
    : ''
  const cleanStatus = MEMBERSHIP_STATUSES.includes(status) ? status : ''
  const cleanRole = [
    'member',
    'focal_point',
    'wg_contact',
    'ngo_admin',
    'admin',
  ].includes(role)
    ? role
    : ''
  const cleanSort = ACCOUNT_SORTS[sort] ? sort : 'newest'
  const cleanPage = Math.min(100_000, Math.max(1, Number.parseInt(page, 10) || 1))
  const cleanPageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(pageSize, 10) || 12),
  )
  const pool = requirePgPool()
  const values: any[] = []
  const where: string[] = []
  const add = (clause: string, value: any) => {
    values.push(value)
    where.push(clause.replace('?', `$${values.length}`))
  }
  if (cleanSearch)
    add(
      `concat_ws(' ', name, email, organization_name, country) ILIKE ?`,
      `%${cleanSearch}%`,
    )
  if (cleanEntityType) add('entity_type = ?', cleanEntityType)
  if (cleanStatus) add('membership_status = ?', cleanStatus)
  if (cleanRole) add('role = ?', cleanRole)
  const filter = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const count = await pool.query(
    `SELECT count(*)::int AS total FROM accounts ${filter}`,
    values,
  )
  const total = count.rows[0]?.total || 0
  const pages = Math.max(1, Math.ceil(total / cleanPageSize))
  const currentPage = Math.min(cleanPage, pages)
  const limitIndex = values.length + 1
  const offsetIndex = values.length + 2
  const { rows } = await pool.query(
    `SELECT ${ADMIN_COLUMNS} FROM accounts
     ${filter}
     ORDER BY ${ACCOUNT_SORTS[cleanSort]}
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    [...values, cleanPageSize, (currentPage - 1) * cleanPageSize],
  )
  return {
    items: rows.map(accountView),
    total,
    page: currentPage,
    pageSize: cleanPageSize,
    pages,
  }
}

export async function setTeamAssignment({
  accountId,
  teamRole,
  enabled,
  assignedBy,
}: {
  accountId: number | string
  teamRole: string
  enabled: boolean
  assignedBy?: number | string | null
}) {
  const pool = requirePgPool()
  if (enabled) {
    const updated = await pool.query(
      `UPDATE assignments
       SET status='active', ends_at=NULL, assigned_by_id=$3, updated_at=now()
       WHERE account_id=$1 AND scope_type='team' AND scope_id=$2 AND role='member'`,
      [accountId, teamRole, assignedBy || null],
    )
    if (!updated.rowCount) {
      await pool.query(
        `INSERT INTO assignments(account_id, scope_type, scope_id, role, status, assigned_by_id)
         VALUES($1,'team',$2,'member','active',$3)
         ON CONFLICT(account_id,scope_type,scope_id,role)
         DO UPDATE SET status='active', ends_at=NULL, assigned_by_id=EXCLUDED.assigned_by_id, updated_at=now()`,
        [accountId, teamRole, assignedBy || null],
      )
    }
    return
  }
  await pool.query(
    `UPDATE assignments SET status='inactive', ends_at=now(), updated_at=now()
     WHERE account_id=$1 AND scope_type='team' AND scope_id=$2`,
    [accountId, teamRole],
  )
}

export async function ensureOwnerSeat(orgAccount: any) {
  if (
    !orgAccount ||
    orgAccount.entityType !== 'organization' ||
    !orgAccount.isVerified ||
    !['ngo_admin', 'admin'].includes(orgAccount.role)
  )
    return null
  const pool = requirePgPool()
  const existing = await pool.query(
    `SELECT * FROM ngo_seats
     WHERE org_account_id=$1 AND seat_role='owner' AND status='active'
     LIMIT 1`,
    [orgAccount.id],
  )
  if (existing.rowCount) return existing.rows[0]
  const { rows } = await pool.query(
    `INSERT INTO ngo_seats (org_account_id, member_account_id, email, name, seat_role, status, accepted_at)
     VALUES ($1,$2,$3,$4,'owner','active', now())
     RETURNING *`,
    [orgAccount.id, orgAccount.id, orgAccount.email, orgAccount.name],
  )
  return rows[0]
}
