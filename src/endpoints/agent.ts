import type { AccountLike, AnyValue, Doc } from '../lib/domain'
import type { Endpoint, PayloadRequest } from 'payload'
import { createHash } from 'node:crypto'
import { ApiError, endpoint, fail, json, readBody, param } from '../lib/respond'
import { requireAccount } from '../lib/accounts'
import { audit } from '../lib/audit'
import { rateLimit } from '../lib/rateLimit'
import { isCwActive } from '../lib/accountStatus'
import { AUTHORITY_ROLES } from '../lib/authority'
import { wgActivityView } from '../lib/views'
import { createWgActivity } from '../lib/wgActivities'
import {
  AGENT_TOOLS,
  authenticateKey,
  createKey,
  eligibilityFor,
  listKeys,
  revokeKey,
  tokensEqual,
  whoamiView,
} from '../lib/agentKeys'

const createLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  scope: 'agent-key-create',
  key: (req) => String(req.user?.id ?? 'anon'),
})
const revokeLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  scope: 'agent-key-revoke',
  key: (req) => String(req.user?.id ?? 'anon'),
})
const callLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  scope: 'agent-call',
  key: (req) =>
    createHash('sha256')
      .update(req.headers.get('x-youngo-key') || '')
      .digest('hex'),
})
const MAX_CALL_BYTES = 32 * 1024
const ACTIVITY_KINDS = ['call', 'submission', 'campaign', 'action_point']

const noStore = (res: Response) => {
  res.headers.set('Cache-Control', 'no-store')
  return res
}
const mcpUrl = () =>
  String(process.env.YOUNGO_MCP_PUBLIC_URL || '')
    .trim()
    .replace(/\/+$/, '') || null

// Key minting and revocation re-check the password, as on the legacy Hub.
async function confirmPassword(req: PayloadRequest, account: AnyValue, password: unknown) {
  const ok = await req.payload
    .login({
      collection: 'accounts',
      data: { email: account.email, password: String(password || '') },
      req,
    })
    .then((r) => Boolean(r?.user))
    .catch(() => false)
  if (!ok) throw fail.validation({ currentPassword: 'Current password is incorrect.' })
}

async function groupNames(req: PayloadRequest) {
  const { docs } = await req.payload.find({
    collection: 'working-groups',
    depth: 0,
    limit: 500,
    pagination: false,
    overrideAccess: true,
  })
  const names = new Map((docs as Doc[]).map((g) => [g.slug, g.name]))
  return (slug: string) => names.get(slug) || slug
}

const stableJson = (value: AnyValue): string =>
  Array.isArray(value)
    ? `[${value.map(stableJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`)
          .join(',')}}`
      : JSON.stringify(value)

type Caller = NonNullable<Awaited<ReturnType<typeof authenticateKey>>>

function assertGroup(caller: Caller, wgSlug: unknown) {
  const slug = String(wgSlug || '')
  if (!caller.eligibility.wgSlugs.includes(slug))
    throw fail.forbidden('This key does not manage that working group.')
  return slug
}

// Idempotent agent write: a replay with the same arguments returns the
// stored result; the same key with different arguments is a conflict.
async function withIdempotency(
  req: PayloadRequest,
  caller: Caller,
  tool: string,
  args: AnyValue,
  run: () => Promise<AnyValue>,
) {
  const idempotencyKey = String(args.idempotencyKey || '')
  if (idempotencyKey.length < 8 || idempotencyKey.length > 80)
    throw fail.validation({ idempotencyKey: 'Send an idempotencyKey of 8–80 characters.' })
  const { idempotencyKey: _ignored, ...rest } = args
  const argumentsHash = createHash('sha256').update(stableJson(rest)).digest('hex')
  const where = {
    agentKey: { equals: caller.key.id },
    tool: { equals: tool },
    idempotencyKey: { equals: idempotencyKey },
  }
  const prior = await req.payload.find({
    collection: 'agent-idempotency',
    where,
    limit: 1,
    overrideAccess: true,
  })
  const replay = prior.docs[0] as Doc | undefined
  if (replay) {
    if (replay.argumentsHash !== argumentsHash)
      throw new ApiError(
        409,
        'idempotency_conflict',
        'That idempotencyKey was used with other arguments.',
      )
    return replay.response
  }
  const response = await run()
  await req.payload.create({
    collection: 'agent-idempotency',
    data: { agentKey: caller.key.id, tool, idempotencyKey, argumentsHash, response },
    overrideAccess: true,
    req,
  })
  return response
}

const TOOL_HANDLERS: Record<
  string,
  (req: PayloadRequest, caller: Caller, args: AnyValue) => Promise<AnyValue>
> = {
  async whoami(req, caller) {
    return whoamiView(caller.account, caller.eligibility, await groupNames(req))
  },

  async list_my_groups(req, caller) {
    const name = await groupNames(req)
    return { groups: caller.eligibility.wgSlugs.map((slug) => ({ slug, name: name(slug) })) }
  },

  async list_wg_activity(req, caller, args) {
    const wgSlug = assertGroup(caller, args.wgSlug)
    const { docs } = await req.payload.find({
      collection: 'wg-activities',
      where: { wgSlug: { equals: wgSlug } },
      sort: '-createdAt',
      limit: 50,
      overrideAccess: true,
    })
    return { items: (docs as Doc[]).map(wgActivityView) }
  },

  async add_wg_activity(req, caller, args) {
    const wgSlug = assertGroup(caller, args.wgSlug)
    if (!ACTIVITY_KINDS.includes(args.kind))
      throw fail.validation({ kind: `kind must be one of ${ACTIVITY_KINDS.join(', ')}.` })
    return withIdempotency(req, caller, 'add_wg_activity', args, async () => ({
      activity: await createWgActivity(req, caller.account, wgSlug, args, {
        agentKeyId: caller.key.id,
      }),
    }))
  },

  // Joiners by display name and status only — no email, no account id.
  async list_wg_joiners(req, caller, args) {
    const wgSlug = assertGroup(caller, args.wgSlug)
    const { docs } = await req.payload.find({
      collection: 'wg-progress',
      where: { wgSlug: { equals: wgSlug } },
      sort: '-joinedAt',
      depth: 1,
      limit: 100,
      overrideAccess: true,
    })
    return {
      joiners: (docs as Doc[]).map((row) => ({
        displayName: typeof row.account === 'object' ? row.account?.name || null : null,
        roleInWg: row.roleInWg,
        status: row.status,
        joinedAt: row.joinedAt || row.createdAt,
      })),
    }
  },

  // Counts per working group — no names.
  async constituency_status(req) {
    const name = await groupNames(req)
    const { docs } = await req.payload.find({
      collection: 'working-groups',
      depth: 0,
      limit: 500,
      pagination: false,
      overrideAccess: true,
    })
    const groups = []
    for (const group of docs as Doc[]) {
      const [contacts, members] = await Promise.all([
        req.payload.count({
          collection: 'authority-records',
          where: {
            role: { equals: 'wg.contact_point' },
            scopeId: { equals: group.slug },
            status: { equals: 'active' },
          },
          overrideAccess: true,
        }),
        req.payload.count({
          collection: 'wg-progress',
          where: { wgSlug: { equals: group.slug }, status: { equals: 'active' } },
          overrideAccess: true,
        }),
      ])
      groups.push({
        slug: group.slug,
        name: name(group.slug),
        activeContacts: contacts.totalDocs,
        activeMembers: members.totalDocs,
      })
    }
    return { groups }
  },

  // Mandates whose holder cannot currently exercise them. Refers to the
  // authority record, never to the person's name or email. Audited.
  async mandate_gaps(req, caller) {
    const { docs } = await req.payload.find({
      collection: 'authority-records',
      where: { status: { equals: 'active' } },
      depth: 1,
      limit: 2000,
      pagination: false,
      overrideAccess: true,
    })
    const gaps = []
    for (const record of docs as Doc[]) {
      const spec = AUTHORITY_ROLES[record.role]
      if (!spec?.capabilities?.length) continue
      const holder = record.account as Doc
      const gate = !holder?.emailVerifiedAt
        ? 'pending_email'
        : holder.hubAccessStatus !== 'active'
          ? 'membership_blocked'
          : spec.requiresCw && !isCwActive(holder as AccountLike)
            ? 'not_constituency_work'
            : null
      if (gate)
        gaps.push({
          ref: String(record.id),
          role: record.role,
          scopeType: record.scopeType,
          scopeId: record.scopeId,
          gate,
        })
    }
    await audit(req, caller.account, {
      action: 'agent.mandate_gaps_read',
      targetType: 'agent_key',
      targetId: String(caller.key.id),
      after: { gaps: gaps.length },
    })
    return { gaps }
  },
}

export const agentEndpoints: Endpoint[] = [
  {
    path: '/member/agent',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      const eligibility = await eligibilityFor(req, account)
      return noStore(
        json({
          eligible: eligibility.ok,
          gate: eligibility.gate,
          connectorRole: eligibility.connectorRole,
          groups: eligibility.wgSlugs,
          tools: eligibility.tools,
          mcpUrl: mcpUrl(),
          keys: eligibility.ok ? await listKeys(req, account.id) : [],
        }),
      )
    }),
  },
  {
    path: '/member/agent/keys',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      await createLimit(req)
      const b = await readBody(req)
      await confirmPassword(req, account, b.currentPassword)
      const eligibility = await eligibilityFor(req, account)
      if (!eligibility.ok)
        throw new ApiError(403, 'not_eligible', 'This account cannot hold an agent key right now.')
      const created = await createKey(req, account)
      await audit(req, account, {
        action: 'agent.key_created',
        targetType: 'agent_key',
        targetId: String(created.id),
        after: { prefix: created.prefix, expiresAt: created.expiresAt },
      })
      return noStore(json(created, { status: 201 }))
    }),
  },
  {
    path: '/member/agent/keys/:id/revoke',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireAccount(req)
      await revokeLimit(req)
      await confirmPassword(req, account, (await readBody(req)).currentPassword)
      const key = await req.payload
        .findByID({
          collection: 'agent-keys',
          id: param(req, 'id'),
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)
      if (!key || String(key.account) !== String(account.id) || key.revokedAt) throw fail.notFound()
      await revokeKey(req, key.id, 'revoked')
      await audit(req, account, {
        action: 'agent.key_revoked',
        targetType: 'agent_key',
        targetId: String(key.id),
      })
      return noStore(json({ ok: true }))
    }),
  },
  {
    // Called by the mcp-youngo service, never by browsers: the service
    // token is checked before anything else, then the member's key.
    path: '/agent/v1/call',
    method: 'post',
    handler: endpoint(async (req) => {
      const serviceToken = String(process.env.HUB_AGENT_GATEWAY_TOKEN || '')
      const presented = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
      if (!serviceToken || !tokensEqual(presented, serviceToken))
        throw new ApiError(401, 'gateway_unauthorized', 'Gateway token required.')
      await callLimit(req)
      const b = await readBody(req)
      if (JSON.stringify(b).length > MAX_CALL_BYTES)
        throw new ApiError(413, 'payload_too_large', 'Tool call too large.')
      const caller = await authenticateKey(req, req.headers.get('x-youngo-key') || '')
      if (!caller) throw new ApiError(401, 'agent_key_invalid', 'This agent key is not valid.')
      const tool = String(b.tool || '')
      if (tool === 'describe_tools') return noStore(json({ tools: caller.eligibility.tools }))
      if (!(AGENT_TOOLS as readonly string[]).includes(tool))
        throw new ApiError(404, 'unknown_tool', 'Unknown tool.')
      if (!caller.eligibility.tools.includes(tool))
        throw fail.forbidden('This key cannot call that tool.')
      const args = b.arguments && typeof b.arguments === 'object' ? b.arguments : {}
      return noStore(json(await TOOL_HANDLERS[tool](req, caller, args)))
    }),
  },
]
