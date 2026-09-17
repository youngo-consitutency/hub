import { createHash } from 'node:crypto'
import { getPool } from './db.js'

export class ContributionError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.name = 'ContributionError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

const requiredText = (value, name, max) => {
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

const optionalUrl = (value, name) => {
  if (!value) return null
  let url
  try {
    url = new URL(value)
  } catch {
    throw new ContributionError(
      422,
      'validation',
      `${name} must be a valid URL.`,
    )
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw new ContributionError(
      422,
      'validation',
      `${name} must use HTTP or HTTPS.`,
    )
  return url.toString()
}

const idempotencyKey = (value) => {
  const key = String(value || '').trim()
  if (!key || key.length > 200)
    throw new ContributionError(
      422,
      'idempotency_required',
      'A bounded idempotencyKey is required.',
    )
  return key
}

function citations(input) {
  if (!Array.isArray(input) || input.length === 0)
    throw new ContributionError(
      422,
      'citations_required',
      'At least one immutable source citation is required.',
    )
  return input.map((citation) => ({
    sourceVersionId: requiredText(
      citation?.sourceVersionId,
      'sourceVersionId',
      100,
    ),
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

export function normalizeProjectInput(input = {}) {
  const callId = input.callId ? String(input.callId) : null
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    trackId: requiredText(input.trackId, 'trackId', 100),
    callId,
    title: requiredText(input.title, 'title', 180),
    purpose: requiredText(input.purpose, 'purpose', 4000),
    workingGroupSlug: input.workingGroupSlug
      ? String(input.workingGroupSlug).slice(0, 120)
      : null,
    intendedSubmittingEntity: input.intendedSubmittingEntity
      ? String(input.intendedSubmittingEntity).slice(0, 240)
      : null,
    externalDraftUrl: optionalUrl(input.externalDraftUrl, 'externalDraftUrl'),
    contentText: requiredText(input.contentText, 'contentText', 500_000),
    citations: citations(input.citations),
    isInitiative: !callId,
  }
}

export function normalizeDraftVersionInput(input = {}) {
  const expectedVersion = Number(input.expectedVersion)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    throw new ContributionError(
      422,
      'validation',
      'expectedVersion must be a positive integer.',
    )
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    expectedVersion,
    contentText: requiredText(input.contentText, 'contentText', 500_000),
    externalSnapshotUrl: optionalUrl(
      input.externalSnapshotUrl,
      'externalSnapshotUrl',
    ),
    citations: citations(input.citations),
  }
}

export function normalizeAmendmentInput(input = {}) {
  const targetType = String(input.targetType || '')
  if (!['official_document', 'internal_draft'].includes(targetType))
    throw new ContributionError(422, 'validation', 'Invalid amendment target.')
  const operation = String(input.operation || '')
  if (!['insert', 'replace', 'delete'].includes(operation))
    throw new ContributionError(
      422,
      'validation',
      'Invalid amendment operation.',
    )
  const proposedText =
    operation === 'delete'
      ? null
      : requiredText(input.proposedText, 'proposedText', 100_000)
  if (!input.stableAnchor || typeof input.stableAnchor !== 'object')
    throw new ContributionError(
      422,
      'validation',
      'A stable paragraph anchor is required.',
    )
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    projectId: input.projectId ? String(input.projectId) : null,
    targetType,
    targetDocumentVersionId:
      targetType === 'official_document'
        ? requiredText(
            input.targetDocumentVersionId,
            'targetDocumentVersionId',
            100,
          )
        : null,
    targetProjectVersionId:
      targetType === 'internal_draft'
        ? requiredText(
            input.targetProjectVersionId,
            'targetProjectVersionId',
            100,
          )
        : null,
    stableAnchor: input.stableAnchor,
    operation,
    originalText: requiredText(input.originalText, 'originalText', 100_000),
    proposedText,
    rationale: requiredText(input.rationale, 'rationale', 20_000),
    citations: citations(input.citations),
  }
}

export function normalizeAmendmentRevisionInput(input = {}) {
  const expectedVersion = Number(input.expectedVersion)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    throw new ContributionError(
      422,
      'validation',
      'expectedVersion must be a positive integer.',
    )
  const operation = String(input.operation || '')
  if (!['insert', 'replace', 'delete'].includes(operation))
    throw new ContributionError(
      422,
      'validation',
      'Invalid amendment operation.',
    )
  if (!input.stableAnchor || typeof input.stableAnchor !== 'object')
    throw new ContributionError(
      422,
      'validation',
      'A stable paragraph anchor is required.',
    )
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    expectedVersion,
    stableAnchor: input.stableAnchor,
    operation,
    originalText: requiredText(input.originalText, 'originalText', 100_000),
    proposedText:
      operation === 'delete'
        ? null
        : requiredText(input.proposedText, 'proposedText', 100_000),
    rationale: requiredText(input.rationale, 'rationale', 20_000),
    citations: citations(input.citations),
  }
}

export function normalizeReconciliationSuggestionInput(input = {}) {
  const expectedAmendmentVersion = Number(input.expectedAmendmentVersion)
  const confidence = Number(input.confidence)
  if (
    !Number.isInteger(expectedAmendmentVersion) ||
    expectedAmendmentVersion < 1
  )
    throw new ContributionError(
      422,
      'validation',
      'Expected amendment version is required.',
    )
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    throw new ContributionError(
      422,
      'validation',
      'Mapping confidence must be between 0 and 1.',
    )
  if (!input.suggestedAnchor || typeof input.suggestedAnchor !== 'object')
    throw new ContributionError(
      422,
      'validation',
      'A suggested anchor is required.',
    )
  if (!input.mappingEvidence || typeof input.mappingEvidence !== 'object')
    throw new ContributionError(
      422,
      'validation',
      'Mapping evidence is required.',
    )
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    expectedAmendmentVersion,
    suggestedDocumentVersionId: requiredText(
      input.suggestedDocumentVersionId,
      'suggestedDocumentVersionId',
      100,
    ),
    suggestedAnchor: input.suggestedAnchor,
    mappingEvidence: input.mappingEvidence,
    confidence,
  }
}

export function normalizeReconciliationConfirmationInput(input = {}) {
  const expectedAmendmentVersion = Number(input.expectedAmendmentVersion)
  if (
    !Number.isInteger(expectedAmendmentVersion) ||
    expectedAmendmentVersion < 1
  )
    throw new ContributionError(
      422,
      'validation',
      'Expected amendment version is required.',
    )
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    expectedAmendmentVersion,
    note: requiredText(input.note, 'note', 1000),
    citations: citations(input.citations),
  }
}

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    )
  return value
}

const contentHash = (payload) =>
  `sha256:${createHash('sha256')
    .update(JSON.stringify(stableValue(payload)))
    .digest('hex')}`

async function beginIdempotentMutation(
  client,
  operation,
  actorId,
  key,
  payload,
) {
  const requestHash = contentHash(payload)
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))`,
    [actorId, `${operation}:${key}`],
  )
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

async function saveIdempotency(
  client,
  { operation, actorId, key, requestHash, response },
) {
  await client.query(
    `INSERT INTO negotiation_mutation_idempotency(
      actor_id,operation,idempotency_key,request_hash,response_payload
     ) VALUES($1,$2,$3,$4,$5)`,
    [actorId, operation, key, requestHash, JSON.stringify(response)],
  )
}

export function assertExpectedVersion(currentVersion, expectedVersion) {
  if (Number(currentVersion) !== Number(expectedVersion))
    throw new ContributionError(
      409,
      'version_conflict',
      'Draft changed; inspect the current version before retrying.',
    )
}

async function assertCitations(client, evidence) {
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

async function insertEvidence(client, table, ownerColumn, ownerId, evidence) {
  for (const citation of evidence) {
    await client.query(
      `INSERT INTO ${table}(${ownerColumn},source_version_id,location,quote)
       VALUES($1,$2,$3,$4)`,
      [
        ownerId,
        citation.sourceVersionId,
        JSON.stringify(citation.location),
        citation.quote,
      ],
    )
  }
}

async function writeAudit(
  client,
  { accountId, action, targetType, targetId, detail },
) {
  await client.query(
    `INSERT INTO governance_audit(
      actor_id,action,target_type,target_id,after_data,reason
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

function requirePool(pool) {
  if (!pool)
    throw new ContributionError(
      503,
      'database_required',
      'Member proposals require persistent storage.',
    )
  return pool
}

export async function createSubmissionProject({
  account,
  input,
  pool = getPool(),
}) {
  const data = normalizeProjectInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = 'project.create'
    const idempotency = await beginIdempotentMutation(
      client,
      operation,
      account.id,
      data.idempotencyKey,
      data,
    )
    if (idempotency.response) {
      await client.query('COMMIT')
      return idempotency.response
    }
    const track = await client.query(
      "SELECT id FROM negotiation_tracks WHERE id=$1 AND publication_status='published'",
      [data.trackId],
    )
    if (!track.rows[0])
      throw new ContributionError(404, 'not_found', 'Track not found.')
    if (data.callId) {
      const call = await client.query(
        `SELECT 1 FROM negotiation_calls c JOIN negotiation_track_calls tc ON tc.call_id=c.id
         WHERE c.id=$1 AND tc.track_id=$2 AND c.publication_status='published'`,
        [data.callId, data.trackId],
      )
      if (!call.rows[0])
        throw new ContributionError(
          422,
          'invalid_call',
          'Call is not a published call for this track.',
        )
    }
    await assertCitations(client, data.citations)
    const project = await client.query(
      `INSERT INTO negotiation_submission_projects(
        track_id,call_id,title,purpose,working_group_slug,
        intended_submitting_entity,external_draft_url,is_initiative,created_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,title,is_initiative,lifecycle_status,current_version`,
      [
        data.trackId,
        data.callId,
        data.title,
        data.purpose,
        data.workingGroupSlug,
        data.intendedSubmittingEntity,
        data.externalDraftUrl,
        data.isInitiative,
        account.id,
      ],
    )
    await client.query(
      `INSERT INTO negotiation_submission_project_members(project_id,account_id,role,added_by)
       VALUES($1,$2,'owner',$2)`,
      [project.rows[0].id, account.id],
    )
    const hash = contentHash({
      contentText: data.contentText,
      citations: data.citations,
    })
    const version = await client.query(
      `INSERT INTO negotiation_submission_versions(
        project_id,version,content_text,content_hash,external_snapshot_url,authored_by
       ) VALUES($1,1,$2,$3,$4,$5) RETURNING id,version,content_hash,created_at`,
      [
        project.rows[0].id,
        data.contentText,
        hash,
        data.externalDraftUrl,
        account.id,
      ],
    )
    await insertEvidence(
      client,
      'negotiation_submission_evidence',
      'project_version_id',
      version.rows[0].id,
      data.citations,
    )
    await client.query(
      `UPDATE negotiation_submission_projects SET current_version=1,updated_at=now() WHERE id=$1`,
      [project.rows[0].id],
    )
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.project.created',
      targetType: 'negotiation_submission_project',
      targetId: project.rows[0].id,
      detail: {
        trackId: data.trackId,
        callId: data.callId,
        isInitiative: data.isInitiative,
        versionId: version.rows[0].id,
        contentHash: hash,
      },
    })
    const response = {
      ...project.rows[0],
      current_version: 1,
      version: version.rows[0],
    }
    await saveIdempotency(client, {
      operation,
      actorId: account.id,
      key: data.idempotencyKey,
      requestHash: idempotency.requestHash,
      response,
    })
    await client.query('COMMIT')
    return response
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function assertProjectWrite(client, projectId, accountId) {
  const project = await client.query(
    `SELECT p.* FROM negotiation_submission_projects p
     JOIN negotiation_submission_project_members m ON m.project_id=p.id
     WHERE p.id=$1 AND m.account_id=$2 AND m.role IN ('owner','contributor')
     FOR UPDATE OF p`,
    [projectId, accountId],
  )
  if (!project.rows[0])
    throw new ContributionError(404, 'not_found', 'Project not found.')
  return project.rows[0]
}

async function assertAmendmentWrite(client, amendmentId, accountId) {
  const amendment = await client.query(
    `SELECT a.* FROM negotiation_amendments a
     LEFT JOIN negotiation_submission_project_members m
       ON m.project_id=a.project_id AND m.account_id=$2
       AND m.role IN ('owner','contributor')
     WHERE a.id=$1 AND (a.author_id=$2 OR m.account_id IS NOT NULL)
     FOR UPDATE OF a`,
    [amendmentId, accountId],
  )
  if (!amendment.rows[0])
    throw new ContributionError(404, 'not_found', 'Amendment not found.')
  return amendment.rows[0]
}

export async function appendSubmissionVersion({
  account,
  projectId,
  input,
  pool = getPool(),
}) {
  const data = normalizeDraftVersionInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = `project.version.create:${projectId}`
    const idempotency = await beginIdempotentMutation(
      client,
      operation,
      account.id,
      data.idempotencyKey,
      data,
    )
    if (idempotency.response) {
      await client.query('COMMIT')
      return idempotency.response
    }
    const project = await assertProjectWrite(client, projectId, account.id)
    assertExpectedVersion(project.current_version, data.expectedVersion)
    await assertCitations(client, data.citations)
    const base = await client.query(
      `SELECT id FROM negotiation_submission_versions WHERE project_id=$1 AND version=$2`,
      [projectId, data.expectedVersion],
    )
    const nextVersion = data.expectedVersion + 1
    const hash = contentHash({
      contentText: data.contentText,
      citations: data.citations,
    })
    const version = await client.query(
      `INSERT INTO negotiation_submission_versions(
        project_id,version,base_version_id,content_text,content_hash,
        external_snapshot_url,authored_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id,version,content_hash,created_at`,
      [
        projectId,
        nextVersion,
        base.rows[0].id,
        data.contentText,
        hash,
        data.externalSnapshotUrl,
        account.id,
      ],
    )
    await insertEvidence(
      client,
      'negotiation_submission_evidence',
      'project_version_id',
      version.rows[0].id,
      data.citations,
    )
    await client.query(
      `UPDATE negotiation_submission_projects SET current_version=$2,
       lifecycle_status=CASE WHEN lifecycle_status IN ('endorsed','ready_for_transmission') THEN 'drafting' ELSE lifecycle_status END,
       updated_at=now() WHERE id=$1`,
      [projectId, nextVersion],
    )
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.project.version_created',
      targetType: 'negotiation_submission_project',
      targetId: projectId,
      detail: {
        versionId: version.rows[0].id,
        version: nextVersion,
        baseVersion: data.expectedVersion,
        contentHash: hash,
      },
    })
    await saveIdempotency(client, {
      operation,
      actorId: account.id,
      key: data.idempotencyKey,
      requestHash: idempotency.requestHash,
      response: version.rows[0],
    })
    await client.query('COMMIT')
    return version.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function createAmendment({ account, input, pool = getPool() }) {
  const data = normalizeAmendmentInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = 'amendment.create'
    const idempotency = await beginIdempotentMutation(
      client,
      operation,
      account.id,
      data.idempotencyKey,
      data,
    )
    if (idempotency.response) {
      await client.query('COMMIT')
      return idempotency.response
    }
    if (data.projectId)
      await assertProjectWrite(client, data.projectId, account.id)
    if (data.targetType === 'official_document') {
      const target = await client.query(
        `SELECT 1 FROM negotiation_document_versions v
         JOIN negotiation_documents d ON d.id=v.document_id
         JOIN negotiation_sources s ON s.id=d.source_id
         WHERE v.id=$1 AND d.publication_status='published' AND s.publication_status='published'`,
        [data.targetDocumentVersionId],
      )
      if (!target.rows[0])
        throw new ContributionError(
          404,
          'not_found',
          'Target version not found.',
        )
    } else {
      const target = await client.query(
        `SELECT 1 FROM negotiation_submission_versions v
         JOIN negotiation_submission_project_members m ON m.project_id=v.project_id
         WHERE v.id=$1 AND m.account_id=$2`,
        [data.targetProjectVersionId, account.id],
      )
      if (!target.rows[0])
        throw new ContributionError(
          404,
          'not_found',
          'Target version not found.',
        )
    }
    await assertCitations(client, data.citations)
    const amendment = await client.query(
      `INSERT INTO negotiation_amendments(
        project_id,target_type,target_document_version_id,target_project_version_id,
        stable_anchor,operation,original_text,proposed_text,rationale,author_id
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,current_version`,
      [
        data.projectId,
        data.targetType,
        data.targetDocumentVersionId,
        data.targetProjectVersionId,
        JSON.stringify(data.stableAnchor),
        data.operation,
        data.originalText,
        data.proposedText,
        data.rationale,
        account.id,
      ],
    )
    const hash = contentHash(data)
    const version = await client.query(
      `INSERT INTO negotiation_amendment_versions(
        amendment_id,version,content_hash,operation,original_text,
        proposed_text,rationale,stable_anchor,authored_by
       ) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,version,content_hash,created_at`,
      [
        amendment.rows[0].id,
        hash,
        data.operation,
        data.originalText,
        data.proposedText,
        data.rationale,
        JSON.stringify(data.stableAnchor),
        account.id,
      ],
    )
    await insertEvidence(
      client,
      'negotiation_amendment_evidence',
      'amendment_version_id',
      version.rows[0].id,
      data.citations,
    )
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.amendment.created',
      targetType: 'negotiation_amendment',
      targetId: amendment.rows[0].id,
      detail: {
        targetType: data.targetType,
        targetDocumentVersionId: data.targetDocumentVersionId,
        targetProjectVersionId: data.targetProjectVersionId,
        versionId: version.rows[0].id,
        contentHash: hash,
        operation: data.operation,
      },
    })
    const response = { ...amendment.rows[0], version: version.rows[0] }
    await saveIdempotency(client, {
      operation,
      actorId: account.id,
      key: data.idempotencyKey,
      requestHash: idempotency.requestHash,
      response,
    })
    await client.query('COMMIT')
    return response
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listAccessibleProjects({ account, pool = getPool() }) {
  const db = requirePool(pool)
  const { rows } = await db.query(
    `SELECT DISTINCT p.id,p.title,p.purpose,p.is_initiative,p.lifecycle_status,
      p.current_version,p.updated_at,t.slug AS track_slug,t.topic AS track_topic
     FROM negotiation_submission_projects p
     JOIN negotiation_tracks t ON t.id=p.track_id
     LEFT JOIN negotiation_submission_project_members m
       ON m.project_id=p.id AND m.account_id=$1
     LEFT JOIN account_assignments a
       ON a.account_id=$1 AND a.scope_type='negotiation_project'
       AND a.scope_id=p.id::text AND a.status='active'
       AND (a.ends_at IS NULL OR a.ends_at>now())
     WHERE m.account_id IS NOT NULL OR a.id IS NOT NULL
     ORDER BY p.updated_at DESC`,
    [account.id],
  )
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    purpose: row.purpose,
    isInitiative: row.is_initiative,
    lifecycleStatus: row.lifecycle_status,
    currentVersion: row.current_version,
    updatedAt: row.updated_at,
    track: { slug: row.track_slug, topic: row.track_topic },
  }))
}

export async function getAccessibleProject({
  account,
  projectId,
  pool = getPool(),
}) {
  const db = requirePool(pool)
  const projectResult = await db.query(
    `SELECT p.*,t.slug AS track_slug,t.topic AS track_topic,c.title AS call_title
     FROM negotiation_submission_projects p
     JOIN negotiation_tracks t ON t.id=p.track_id
     LEFT JOIN negotiation_calls c ON c.id=p.call_id
     WHERE p.id=$2 AND (
       EXISTS (SELECT 1 FROM negotiation_submission_project_members m
         WHERE m.project_id=p.id AND m.account_id=$1)
       OR EXISTS (SELECT 1 FROM account_assignments a
         WHERE a.account_id=$1 AND a.scope_type='negotiation_project'
           AND a.scope_id=p.id::text AND a.status='active'
           AND (a.ends_at IS NULL OR a.ends_at>now()))
     )`,
    [account.id, projectId],
  )
  const project = projectResult.rows[0]
  if (!project)
    throw new ContributionError(404, 'not_found', 'Project not found.')
  const [versions, amendments] = await Promise.all([
    db.query(
      `SELECT v.id,v.version,v.base_version_id,v.content_text,v.content_hash,
        v.external_snapshot_url,v.authored_by,v.created_at,
        COALESCE(jsonb_agg(jsonb_build_object(
          'sourceVersionId',e.source_version_id,'location',e.location,'quote',e.quote
        )) FILTER (WHERE e.source_version_id IS NOT NULL),'[]'::jsonb) AS citations
       FROM negotiation_submission_versions v
       LEFT JOIN negotiation_submission_evidence e ON e.project_version_id=v.id
       WHERE v.project_id=$1 GROUP BY v.id ORDER BY v.version DESC`,
      [projectId],
    ),
    db.query(
      `SELECT a.id,a.target_type,a.target_document_version_id,
        a.target_project_version_id,a.stable_anchor,a.operation,a.original_text,
        a.proposed_text,a.rationale,a.decision_status,a.reconciliation_status,
        a.author_id,a.current_version,a.created_at,a.updated_at
       FROM negotiation_amendments a WHERE a.project_id=$1
       ORDER BY a.updated_at DESC`,
      [projectId],
    ),
  ])
  return {
    id: project.id,
    title: project.title,
    purpose: project.purpose,
    isInitiative: project.is_initiative,
    lifecycleStatus: project.lifecycle_status,
    currentVersion: project.current_version,
    workingGroupSlug: project.working_group_slug,
    intendedSubmittingEntity: project.intended_submitting_entity,
    externalDraftUrl: project.external_draft_url,
    track: {
      id: project.track_id,
      slug: project.track_slug,
      topic: project.track_topic,
    },
    call: project.call_id
      ? { id: project.call_id, title: project.call_title }
      : null,
    versions: versions.rows.map((row) => ({
      id: row.id,
      version: row.version,
      baseVersionId: row.base_version_id,
      contentText: row.content_text,
      contentHash: row.content_hash,
      externalSnapshotUrl: row.external_snapshot_url,
      authoredBy: row.authored_by,
      createdAt: row.created_at,
      citations: row.citations,
    })),
    amendments: amendments.rows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetDocumentVersionId: row.target_document_version_id,
      targetProjectVersionId: row.target_project_version_id,
      stableAnchor: row.stable_anchor,
      operation: row.operation,
      originalText: row.original_text,
      proposedText: row.proposed_text,
      rationale: row.rationale,
      decisionStatus: row.decision_status,
      reconciliationStatus: row.reconciliation_status,
      authorId: row.author_id,
      currentVersion: row.current_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  }
}

export async function appendAmendmentVersion({
  account,
  amendmentId,
  input,
  pool = getPool(),
}) {
  const data = normalizeAmendmentRevisionInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = `amendment.version.create:${amendmentId}`
    const idempotency = await beginIdempotentMutation(
      client,
      operation,
      account.id,
      data.idempotencyKey,
      data,
    )
    if (idempotency.response) {
      await client.query('COMMIT')
      return idempotency.response
    }
    const amendment = await assertAmendmentWrite(
      client,
      amendmentId,
      account.id,
    )
    assertExpectedVersion(amendment.current_version, data.expectedVersion)
    await assertCitations(client, data.citations)
    const nextVersion = data.expectedVersion + 1
    const hash = contentHash(data)
    const version = await client.query(
      `INSERT INTO negotiation_amendment_versions(
        amendment_id,version,content_hash,operation,original_text,
        proposed_text,rationale,stable_anchor,authored_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,version,content_hash,created_at`,
      [
        amendmentId,
        nextVersion,
        hash,
        data.operation,
        data.originalText,
        data.proposedText,
        data.rationale,
        JSON.stringify(data.stableAnchor),
        account.id,
      ],
    )
    await insertEvidence(
      client,
      'negotiation_amendment_evidence',
      'amendment_version_id',
      version.rows[0].id,
      data.citations,
    )
    await client.query(
      `UPDATE negotiation_amendments SET current_version=$2,stable_anchor=$3,
       operation=$4,original_text=$5,proposed_text=$6,rationale=$7,
       decision_status='draft',updated_at=now() WHERE id=$1`,
      [
        amendmentId,
        nextVersion,
        JSON.stringify(data.stableAnchor),
        data.operation,
        data.originalText,
        data.proposedText,
        data.rationale,
      ],
    )
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.amendment.version_created',
      targetType: 'negotiation_amendment',
      targetId: amendmentId,
      detail: {
        versionId: version.rows[0].id,
        version: nextVersion,
        contentHash: hash,
      },
    })
    await saveIdempotency(client, {
      operation,
      actorId: account.id,
      key: data.idempotencyKey,
      requestHash: idempotency.requestHash,
      response: version.rows[0],
    })
    await client.query('COMMIT')
    return version.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function suggestAmendmentReconciliation({
  account,
  amendmentId,
  input,
  pool = getPool(),
}) {
  const data = normalizeReconciliationSuggestionInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = `amendment.reconciliation.suggest:${amendmentId}`
    const idempotency = await beginIdempotentMutation(
      client,
      operation,
      account.id,
      data.idempotencyKey,
      data,
    )
    if (idempotency.response) {
      await client.query('COMMIT')
      return idempotency.response
    }
    const amendment = await assertAmendmentWrite(
      client,
      amendmentId,
      account.id,
    )
    if (amendment.target_type !== 'official_document')
      throw new ContributionError(
        422,
        'invalid_target',
        'Only official-document amendments use document reconciliation.',
      )
    assertExpectedVersion(
      amendment.current_version,
      data.expectedAmendmentVersion,
    )
    const target = await client.query(
      `SELECT 1 FROM negotiation_document_versions old
       JOIN negotiation_document_versions proposed
         ON proposed.document_id=old.document_id
       JOIN negotiation_documents d ON d.id=proposed.document_id
       JOIN negotiation_sources s ON s.id=d.source_id
       WHERE old.id=$1 AND proposed.id=$2
         AND d.publication_status='published' AND s.publication_status='published'`,
      [amendment.target_document_version_id, data.suggestedDocumentVersionId],
    )
    if (!target.rows[0])
      throw new ContributionError(
        422,
        'invalid_mapping_target',
        'Suggested target must be a published version of the same document.',
      )
    const inserted = await client.query(
      `INSERT INTO negotiation_amendment_reconciliations(
        amendment_id,from_document_version_id,suggested_document_version_id,
        suggested_anchor,mapping_evidence,confidence
       ) VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,status,confidence,created_at`,
      [
        amendmentId,
        amendment.target_document_version_id,
        data.suggestedDocumentVersionId,
        JSON.stringify(data.suggestedAnchor),
        JSON.stringify(data.mappingEvidence),
        data.confidence,
      ],
    )
    await client.query(
      `UPDATE negotiation_amendments SET reconciliation_status='mapping_suggested',
       updated_at=now() WHERE id=$1`,
      [amendmentId],
    )
    const response = {
      ...inserted.rows[0],
      suggestedDocumentVersionId: data.suggestedDocumentVersionId,
      suggestedAnchor: data.suggestedAnchor,
    }
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.amendment.reconciliation_suggested',
      targetType: 'negotiation_amendment',
      targetId: amendmentId,
      detail: {
        reconciliationId: inserted.rows[0].id,
        fromVersionId: amendment.target_document_version_id,
        suggestedVersionId: data.suggestedDocumentVersionId,
        confidence: data.confidence,
      },
    })
    await saveIdempotency(client, {
      operation,
      actorId: account.id,
      key: data.idempotencyKey,
      requestHash: idempotency.requestHash,
      response,
    })
    await client.query('COMMIT')
    return response
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function confirmAmendmentReconciliation({
  account,
  amendmentId,
  reconciliationId,
  input,
  pool = getPool(),
}) {
  const data = normalizeReconciliationConfirmationInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = `amendment.reconciliation.confirm:${reconciliationId}`
    const idempotency = await beginIdempotentMutation(
      client,
      operation,
      account.id,
      data.idempotencyKey,
      data,
    )
    if (idempotency.response) {
      await client.query('COMMIT')
      return idempotency.response
    }
    const amendment = await assertAmendmentWrite(
      client,
      amendmentId,
      account.id,
    )
    assertExpectedVersion(
      amendment.current_version,
      data.expectedAmendmentVersion,
    )
    const reconciliation = await client.query(
      `SELECT * FROM negotiation_amendment_reconciliations
       WHERE id=$1 AND amendment_id=$2 AND status='suggested' FOR UPDATE`,
      [reconciliationId, amendmentId],
    )
    if (!reconciliation.rows[0])
      throw new ContributionError(
        409,
        'reconciliation_conflict',
        'Mapping is no longer pending.',
      )
    if (
      !data.citations.some(
        (citation) =>
          citation.sourceVersionId ===
          String(reconciliation.rows[0].suggested_document_version_id),
      )
    )
      throw new ContributionError(
        422,
        'new_version_citation_required',
        'Confirmation requires evidence from the suggested source version.',
      )
    await assertCitations(client, data.citations)
    const currentVersion = await client.query(
      `SELECT * FROM negotiation_amendment_versions
       WHERE amendment_id=$1 AND version=$2`,
      [amendmentId, data.expectedAmendmentVersion],
    )
    const nextVersion = data.expectedAmendmentVersion + 1
    const current = currentVersion.rows[0]
    if (!current)
      throw new ContributionError(
        409,
        'version_conflict',
        'The amendment version is no longer available.',
      )
    const versionPayload = {
      operation: current.operation,
      originalText: current.original_text,
      proposedText: current.proposed_text,
      rationale: current.rationale,
      stableAnchor: reconciliation.rows[0].suggested_anchor,
      citations: data.citations,
    }
    const hash = contentHash(versionPayload)
    const version = await client.query(
      `INSERT INTO negotiation_amendment_versions(
        amendment_id,version,content_hash,operation,original_text,
        proposed_text,rationale,stable_anchor,authored_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,version,content_hash,created_at`,
      [
        amendmentId,
        nextVersion,
        hash,
        current.operation,
        current.original_text,
        current.proposed_text,
        current.rationale,
        JSON.stringify(reconciliation.rows[0].suggested_anchor),
        account.id,
      ],
    )
    await insertEvidence(
      client,
      'negotiation_amendment_evidence',
      'amendment_version_id',
      version.rows[0].id,
      data.citations,
    )
    await client.query(
      `UPDATE negotiation_amendment_reconciliations SET status='confirmed',
       confirmed_by=$2,confirmed_at=now() WHERE id=$1`,
      [reconciliationId, account.id],
    )
    await client.query(
      `UPDATE negotiation_amendments SET target_document_version_id=$2,
       stable_anchor=$3,current_version=$4,reconciliation_status='confirmed',
       decision_status='draft',updated_at=now() WHERE id=$1`,
      [
        amendmentId,
        reconciliation.rows[0].suggested_document_version_id,
        JSON.stringify(reconciliation.rows[0].suggested_anchor),
        nextVersion,
      ],
    )
    const response = {
      reconciliationId,
      status: 'confirmed',
      targetDocumentVersionId:
        reconciliation.rows[0].suggested_document_version_id,
      version: version.rows[0],
      reviewRequired: true,
      note: data.note,
    }
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.amendment.reconciliation_confirmed',
      targetType: 'negotiation_amendment',
      targetId: amendmentId,
      detail: {
        reconciliationId,
        targetDocumentVersionId: response.targetDocumentVersionId,
        amendmentVersion: nextVersion,
        contentHash: hash,
        reviewRequired: true,
      },
    })
    await saveIdempotency(client, {
      operation,
      actorId: account.id,
      key: data.idempotencyKey,
      requestHash: idempotency.requestHash,
      response,
    })
    await client.query('COMMIT')
    return response
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
