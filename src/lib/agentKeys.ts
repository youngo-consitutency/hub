import type { PayloadRequest } from 'payload'
import type { AccountLike, AnyValue, Doc } from './domain'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getAccessProfile, hasCapability } from './access'
import { ApiError } from './respond'

// Personal agent keys for the YOUNGO MCP gateway. Eligibility is derived
// from authority records on every use, never stored: a key works only
// while its holder still has the mandate it was minted for.
export const KEY_PREFIX = 'yk_live_'
export const KEY_LIFETIME_DAYS = 90
export const MAX_ACTIVE_KEYS = 3
const INACTIVE_MEMBERSHIP = ['expired', 'terminated', 'rejected']

export const AGENT_TOOLS = [
  'whoami',
  'constituency_status',
  'mandate_gaps',
  'list_my_groups',
  'list_wg_activity',
  'add_wg_activity',
  'list_wg_joiners',
] as const
const GROUP_TOOLS = ['list_my_groups', 'list_wg_activity', 'add_wg_activity', 'list_wg_joiners']

export const hashKey = (secret: string) => createHash('sha256').update(secret).digest('hex')

export function mintSecret() {
  const secret = `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`
  return { secret, prefix: secret.slice(0, KEY_PREFIX.length + 6), tokenHash: hashKey(secret) }
}

export function tokensEqual(a: string, b: string) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && timingSafeEqual(left, right)
}

const operatorIds = () =>
  new Set(
    String(process.env.YOUNGO_OPERATOR_ACCOUNT_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )

export type Eligibility = {
  ok: boolean
  gate:
    | 'ready'
    | 'demo'
    | 'service_account'
    | 'pending_email'
    | 'membership_blocked'
    | 'password_change_required'
    | 'no_mandate'
  connectorRole: 'operator' | 'focal_point' | 'contact_point' | null
  wgSlugs: string[]
  tools: string[]
}

/**
 * Who may hold a key, and what it may call. Operators need both the account
 * console capability and the deployment allowlist; focal points read
 * constituency counts; contact points get the tools of the groups they
 * manage. Group tools follow any wg.manage:{slug} the account holds.
 */
export function decideEligibility(account: AnyValue, access: AnyValue): Eligibility {
  const deny = (gate: Eligibility['gate']): Eligibility => ({
    ok: false,
    gate,
    connectorRole: null,
    wgSlugs: [],
    tools: [],
  })
  if (process.env.NEXT_PUBLIC_HUB_DEMO === 'true' || process.env.HUB_DEMO_MODE === 'true')
    return deny('demo')
  if (!account) return deny('no_mandate')
  if (account.accountKind === 'service') return deny('service_account')
  if (
    account.hubAccessStatus !== 'active' ||
    INACTIVE_MEMBERSHIP.includes(account.membershipStatus)
  )
    return deny('membership_blocked')
  if (!account.emailVerifiedAt) return deny('pending_email')
  if (account.mustChangePassword) return deny('password_change_required')
  const capabilities: string[] = access?.capabilities || []
  const wgSlugs = capabilities
    .filter((cap) => cap.startsWith('wg.manage:'))
    .map((cap) => cap.slice('wg.manage:'.length))
    .sort()
  const operator = hasCapability(access, 'accounts.manage') && operatorIds().has(String(account.id))
  const connectorRole = operator
    ? 'operator'
    : access?.isFocalPoint
      ? 'focal_point'
      : wgSlugs.length
        ? 'contact_point'
        : null
  if (!connectorRole) return deny('no_mandate')
  const tools = ['whoami']
  if (operator) tools.push('constituency_status', 'mandate_gaps')
  else if (connectorRole === 'focal_point') tools.push('constituency_status')
  if (wgSlugs.length) tools.push(...GROUP_TOOLS)
  return { ok: true, gate: 'ready', connectorRole, wgSlugs, tools }
}

export async function eligibilityFor(req: PayloadRequest, account: AnyValue) {
  return decideEligibility(account, await getAccessProfile(req, account))
}

async function activeKeys(req: PayloadRequest, accountId: AnyValue) {
  const { docs } = await req.payload.find({
    collection: 'agent-keys',
    where: {
      account: { equals: accountId },
      revokedAt: { exists: false },
      expiresAt: { greater_than: new Date().toISOString() },
    },
    depth: 0,
    limit: 20,
    overrideAccess: true,
  })
  return docs as Doc[]
}

export async function listKeys(req: PayloadRequest, accountId: AnyValue) {
  const { docs } = await req.payload.find({
    collection: 'agent-keys',
    where: { account: { equals: accountId } },
    sort: '-createdAt',
    depth: 0,
    limit: 20,
    overrideAccess: true,
  })
  const now = Date.now()
  return (docs as Doc[]).map((key) => ({
    id: key.id,
    prefix: key.prefix,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt || null,
    expiresAt: key.expiresAt,
    revokedAt: key.revokedAt || null,
    state: key.revokedAt ? 'revoked' : Date.parse(key.expiresAt) <= now ? 'expired' : 'active',
  }))
}

export async function createKey(req: PayloadRequest, account: AnyValue) {
  if ((await activeKeys(req, account.id)).length >= MAX_ACTIVE_KEYS)
    throw new ApiError(
      409,
      'key_limit',
      `Revoke a key first — an account can hold ${MAX_ACTIVE_KEYS} active keys.`,
    )
  const { secret, prefix, tokenHash } = mintSecret()
  const expiresAt = new Date(Date.now() + KEY_LIFETIME_DAYS * 86_400_000).toISOString()
  const created = await req.payload.create({
    collection: 'agent-keys',
    data: {
      account: account.id,
      tokenHash,
      prefix,
      credentialEpoch: account.credentialEpoch || 1,
      expiresAt,
    },
    overrideAccess: true,
    req,
  })
  return { id: created.id, key: secret, prefix, expiresAt }
}

export async function revokeKey(req: PayloadRequest, id: AnyValue, reason: string) {
  await req.payload.update({
    collection: 'agent-keys',
    id,
    data: { revokedAt: new Date().toISOString(), revokedReason: reason },
    overrideAccess: true,
    req,
  })
}

/**
 * Resolve a presented key to its holder and current eligibility. A key
 * minted before the latest password change, or whose holder lost the
 * mandate, is revoked on the spot rather than left dangling.
 */
export async function authenticateKey(req: PayloadRequest, secret: string) {
  if (!secret.startsWith(KEY_PREFIX)) return null
  const { docs } = await req.payload.find({
    collection: 'agent-keys',
    where: { tokenHash: { equals: hashKey(secret) } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const key = docs[0] as Doc | undefined
  if (!key || key.revokedAt || Date.parse(key.expiresAt) <= Date.now()) return null
  const account = await req.payload
    .findByID({ collection: 'accounts', id: key.account, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!account) return null
  if ((account.credentialEpoch || 1) !== key.credentialEpoch) {
    await revokeKey(req, key.id, 'password_changed')
    return null
  }
  const eligibility = await eligibilityFor(req, account)
  if (!eligibility.ok) {
    await revokeKey(req, key.id, 'eligibility_lost')
    return null
  }
  await req.payload.update({
    collection: 'agent-keys',
    id: key.id,
    data: { lastUsedAt: new Date().toISOString() },
    overrideAccess: true,
    req,
  })
  return { key, account: account as unknown as AccountLike, eligibility }
}

const WHOAMI_KEYS = ['accountId', 'displayName', 'connectorRole', 'groups', 'tools']

// whoami answers with these fields only — never email, phone or capabilities.
export function whoamiView(account: Doc, eligibility: Eligibility, groupName: AnyValue) {
  const view = {
    accountId: account.id,
    displayName: account.name,
    connectorRole: eligibility.connectorRole,
    groups: eligibility.wgSlugs.map((slug) => ({ slug, name: groupName(slug) })),
    tools: eligibility.tools,
  }
  if (Object.keys(view).some((key) => !WHOAMI_KEYS.includes(key)))
    throw new Error('whoami must not grow private fields.')
  return view
}
