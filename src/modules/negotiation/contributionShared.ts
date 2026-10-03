// Shared negotiation-contribution internals: validation, citations,
// idempotency, content hashing, evidence + audit writes, and the
// project/amendment write guards.
import { createHash } from 'node:crypto'
import { type Pool, type PoolClient } from 'pg'
import type { Doc } from '../../lib/domain'

export class ContributionError extends Error {
  status: number
  code: string
  fields?: Record<string, string>
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ContributionError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const requiredText = (value: any, name: string, max: number) => {
  const text = String(value || '').trim()
  if (!text || text.length > max)
    throw new ContributionError(
      422,
      'validation',
      `${name} is required and must be at most ${max} characters.`,
      { [name]: 'Check this field.' },
    )
  return text
}

export const optionalUrl = (value: any, name: string) => {
  if (!value) return null
  let url
  try {
    url = new URL(value)
  } catch {
    throw new ContributionError(422, 'validation', `${name} must be a valid URL.`)
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw new ContributionError(422, 'validation', `${name} must use HTTP or HTTPS.`)
  return url.toString()
}

export const idempotencyKey = (value: any) => {
  const key = String(value || '').trim()
  if (!key || key.length > 200)
    throw new ContributionError(
      422,
      'idempotency_required',
      'A bounded idempotencyKey is required.',
    )
  return key
}

export function citations(input: any) {
  if (!Array.isArray(input) || input.length === 0)
    throw new ContributionError(
      422,
      'citations_required',
      'At least one immutable source citation is required.',
    )
  return input.map((citation: any) => ({
    sourceVersionId: requiredText(citation?.sourceVersionId, 'sourceVersionId', 100),
    location:
      citation?.location && typeof citation.location === 'object'
        ? citation.location
        : (() => {
            throw new ContributionError(
              422,
              'validation',
              'Each citation requires a source location.',
            )
          })(),
    quote: citation?.quote ? String(citation.quote).slice(0, 2000) : null,
  }))
}

const stableValue = (value: any): any => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    )
  return value
}

export const contentHash = (payload: any) =>
  `sha256:${createHash('sha256')
    .update(JSON.stringify(stableValue(payload)))
    .digest('hex')}`

export async function beginIdempotentMutation(
  client: PoolClient,
  operation: string,
  actorId: number,
  key: string,
  payload: any,
) {
  const requestHash = contentHash(payload)
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))`, [
    String(actorId),
    `${operation}:${key}`,
  ])
  const replay = await client.query(
    `SELECT request_hash,response_payload FROM negotiation_mutation_idempotency
     WHERE actor_id=$1 AND operation=$2 AND idempotency_key=$3`,
    [actorId, operation, key],
  )
  if (!replay.rows[0]) return { requestHash, response: null }
  if (replay.rows[0].request_hash !== requestHash)
    throw new ContributionError(
      409,
      'idempotency_conflict',
      'This idempotency key was already used with different content.',
    )
  return { requestHash, response: replay.rows[0].response_payload }
}

export async function saveIdempotency(
  client: PoolClient,
  {
    operation,
    actorId,
    key,
    requestHash,
    response,
  }: {
    operation: string
    actorId: number
    key: string
    requestHash: string
    response: any
  },
) {
  await client.query(
    `INSERT INTO negotiation_mutation_idempotency(
      actor_id,operation,idempotency_key,request_hash,response_payload
     ) VALUES($1,$2,$3,$4,$5)`,
    [actorId, operation, key, requestHash, JSON.stringify(response)],
  )
}

export function assertExpectedVersion(currentVersion: number, expectedVersion: number) {
  if (Number(currentVersion) !== Number(expectedVersion))
    throw new ContributionError(
      409,
      'version_conflict',
      'Draft changed; inspect the current version before retrying.',
    )
}

export async function assertCitations(client: PoolClient, evidence: Doc[]) {
  const ids = [...new Set(evidence.map((item) => item.sourceVersionId))]
  const { rows } = await client.query(
    `SELECT v.id::text FROM negotiation_document_versions v
     JOIN negotiation_documents d ON d.id=v.document_id
     JOIN negotiation_sources s ON s.id=d.source_id
     WHERE v.id = ANY($1::uuid[]) AND d.publication_status='published'
       AND s.publication_status='published'`,
    [ids],
  )
  if (rows.length !== ids.length)
    throw new ContributionError(
      422,
      'invalid_citation',
      'A citation is missing or not available to this member.',
    )
}

export async function insertEvidence(
  client: PoolClient,
  table: string,
  ownerColumn: string,
  ownerId: string,
  evidence: Doc[],
) {
  for (const citation of evidence) {
    await client.query(
      `INSERT INTO ${table}(${ownerColumn},source_version_id,location,quote)
       VALUES($1,$2,$3,$4)`,
      [ownerId, citation.sourceVersionId, JSON.stringify(citation.location), citation.quote],
    )
  }
}

export async function writeAudit(
  client: PoolClient,
  {
    accountId,
    action,
    targetType,
    targetId,
    detail,
  }: {
    accountId: number
    action: string
    targetType: string
    targetId: string
    detail: Doc
  },
) {
  await client.query(
    `INSERT INTO audit_log(
      actor_id,action,target_type,target_id,"after",reason
     ) VALUES($1,$2,$3,$4,$5,$6)`,
    [
      accountId,
      action,
      targetType,
      targetId,
      JSON.stringify(detail),
      'Member negotiation contribution',
    ],
  )
}

export function requirePool(pool: Pool | null): Pool {
  if (!pool)
    throw new ContributionError(
      503,
      'database_required',
      'Member proposals require persistent storage.',
    )
  return pool
}

export async function assertProjectWrite(client: PoolClient, projectId: string, accountId: number) {
  const project = await client.query(
    `SELECT p.* FROM negotiation_submission_projects p
     JOIN negotiation_submission_project_members m ON m.project_id=p.id
     WHERE p.id=$1 AND m.account_id=$2 AND m.role IN ('owner','contributor')
     FOR UPDATE OF p`,
    [projectId, accountId],
  )
  if (!project.rows[0]) throw new ContributionError(404, 'not_found', 'Project not found.')
  return project.rows[0]
}

export async function assertAmendmentWrite(
  client: PoolClient,
  amendmentId: string,
  accountId: number,
) {
  const amendment = await client.query(
    `SELECT a.* FROM negotiation_amendments a
     LEFT JOIN negotiation_submission_project_members m
       ON m.project_id=a.project_id AND m.account_id=$2
       AND m.role IN ('owner','contributor')
     WHERE a.id=$1 AND (a.author_id=$2 OR m.account_id IS NOT NULL)
     FOR UPDATE OF a`,
    [amendmentId, accountId],
  )
  if (!amendment.rows[0]) throw new ContributionError(404, 'not_found', 'Amendment not found.')
  return amendment.rows[0]
}
