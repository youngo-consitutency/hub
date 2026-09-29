// Input normalisation for negotiation contributions — every public entry
// point validates through these before touching the database.
import {
  ContributionError,
  citations,
  idempotencyKey,
  optionalUrl,
  requiredText,
} from './contributionShared'

export function normalizeProjectInput(input: any = {}) {
  const callId = input.callId ? String(input.callId) : null
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    trackId: requiredText(input.trackId, 'trackId', 100),
    callId,
    title: requiredText(input.title, 'title', 180),
    purpose: requiredText(input.purpose, 'purpose', 4000),
    workingGroupSlug: input.workingGroupSlug ? String(input.workingGroupSlug).slice(0, 120) : null,
    intendedSubmittingEntity: input.intendedSubmittingEntity
      ? String(input.intendedSubmittingEntity).slice(0, 240)
      : null,
    externalDraftUrl: optionalUrl(input.externalDraftUrl, 'externalDraftUrl'),
    contentText: requiredText(input.contentText, 'contentText', 500_000),
    citations: citations(input.citations),
    isInitiative: !callId,
  }
}

export function normalizeDraftVersionInput(input: any = {}) {
  const expectedVersion = Number(input.expectedVersion)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    throw new ContributionError(422, 'validation', 'expectedVersion must be a positive integer.')
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    expectedVersion,
    contentText: requiredText(input.contentText, 'contentText', 500_000),
    externalSnapshotUrl: optionalUrl(input.externalSnapshotUrl, 'externalSnapshotUrl'),
    citations: citations(input.citations),
  }
}

export function normalizeAmendmentInput(input: any = {}) {
  const targetType = String(input.targetType || '')
  if (!['official_document', 'internal_draft'].includes(targetType))
    throw new ContributionError(422, 'validation', 'Invalid amendment target.')
  const operation = String(input.operation || '')
  if (!['insert', 'replace', 'delete'].includes(operation))
    throw new ContributionError(422, 'validation', 'Invalid amendment operation.')
  const proposedText =
    operation === 'delete' ? null : requiredText(input.proposedText, 'proposedText', 100_000)
  if (!input.stableAnchor || typeof input.stableAnchor !== 'object')
    throw new ContributionError(422, 'validation', 'A stable paragraph anchor is required.')
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    projectId: input.projectId ? String(input.projectId) : null,
    targetType,
    targetDocumentVersionId:
      targetType === 'official_document'
        ? requiredText(input.targetDocumentVersionId, 'targetDocumentVersionId', 100)
        : null,
    targetProjectVersionId:
      targetType === 'internal_draft'
        ? requiredText(input.targetProjectVersionId, 'targetProjectVersionId', 100)
        : null,
    stableAnchor: input.stableAnchor,
    operation,
    originalText: requiredText(input.originalText, 'originalText', 100_000),
    proposedText,
    rationale: requiredText(input.rationale, 'rationale', 20_000),
    citations: citations(input.citations),
  }
}

export function normalizeAmendmentRevisionInput(input: any = {}) {
  const expectedVersion = Number(input.expectedVersion)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    throw new ContributionError(422, 'validation', 'expectedVersion must be a positive integer.')
  const operation = String(input.operation || '')
  if (!['insert', 'replace', 'delete'].includes(operation))
    throw new ContributionError(422, 'validation', 'Invalid amendment operation.')
  if (!input.stableAnchor || typeof input.stableAnchor !== 'object')
    throw new ContributionError(422, 'validation', 'A stable paragraph anchor is required.')
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    expectedVersion,
    stableAnchor: input.stableAnchor,
    operation,
    originalText: requiredText(input.originalText, 'originalText', 100_000),
    proposedText:
      operation === 'delete' ? null : requiredText(input.proposedText, 'proposedText', 100_000),
    rationale: requiredText(input.rationale, 'rationale', 20_000),
    citations: citations(input.citations),
  }
}

export function normalizeReconciliationSuggestionInput(input: any = {}) {
  const expectedAmendmentVersion = Number(input.expectedAmendmentVersion)
  const confidence = Number(input.confidence)
  if (!Number.isInteger(expectedAmendmentVersion) || expectedAmendmentVersion < 1)
    throw new ContributionError(422, 'validation', 'Expected amendment version is required.')
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    throw new ContributionError(422, 'validation', 'Mapping confidence must be between 0 and 1.')
  if (!input.suggestedAnchor || typeof input.suggestedAnchor !== 'object')
    throw new ContributionError(422, 'validation', 'A suggested anchor is required.')
  if (!input.mappingEvidence || typeof input.mappingEvidence !== 'object')
    throw new ContributionError(422, 'validation', 'Mapping evidence is required.')
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

export function normalizeReconciliationConfirmationInput(input: any = {}) {
  const expectedAmendmentVersion = Number(input.expectedAmendmentVersion)
  if (!Number.isInteger(expectedAmendmentVersion) || expectedAmendmentVersion < 1)
    throw new ContributionError(422, 'validation', 'Expected amendment version is required.')
  return {
    idempotencyKey: idempotencyKey(input.idempotencyKey),
    expectedAmendmentVersion,
    note: requiredText(input.note, 'note', 1000),
    citations: citations(input.citations),
  }
}
