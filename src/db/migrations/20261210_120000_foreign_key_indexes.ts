import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Postgres does not index the referencing side of a foreign key. Without one, every delete or update
// of a referenced row (an account removal, a SET NULL, a CASCADE) scans the whole referencing table,
// and lookups by these columns (a member's projects, a decision's tasks) scan it too.
// Each entry is [index name, table, column]; the names, tables and columns are constants in this file.
const INDEXES: [string, string, string][] = [
  ['authority_records_recorded_by_id_idx', 'authority_records', 'recorded_by_id'],
  ['authority_records_substitute_for_id_idx', 'authority_records', 'substitute_for_id'],
  ['coi_declarations_reviewed_by_id_idx', 'coi_declarations', 'reviewed_by_id'],
  ['decision_events_actor_id_idx', 'decision_events', 'actor_id'],
  ['decision_flags_responded_by_id_idx', 'decision_flags', 'responded_by_id'],
  ['decision_vetoes_requested_by_id_idx', 'decision_vetoes', 'requested_by_id'],
  ['funding_requests_reviewed_by_id_idx', 'funding_requests', 'reviewed_by_id'],
  ['handovers_closed_by_id_idx', 'handovers', 'closed_by_id'],
  ['member_profile_photos_updated_by_idx', 'member_profile_photos', 'updated_by'],
  [
    'negotiation_agenda_lineage_source_version_id_idx',
    'negotiation_agenda_lineage',
    'source_version_id',
  ],
  [
    'negotiation_agenda_lineage_to_agenda_item_id_idx',
    'negotiation_agenda_lineage',
    'to_agenda_item_id',
  ],
  [
    'negotiation_amendment_evidence_source_version_id_idx',
    'negotiation_amendment_evidence',
    'source_version_id',
  ],
  [
    'negotiation_amendment_reconciliations_amendment_id_idx',
    'negotiation_amendment_reconciliations',
    'amendment_id',
  ],
  [
    'negotiation_amendment_reconciliations_confirmed_by_idx',
    'negotiation_amendment_reconciliations',
    'confirmed_by',
  ],
  [
    'negotiation_amendment_reconciliations_from_document_ve_c8adfc',
    'negotiation_amendment_reconciliations',
    'from_document_version_id',
  ],
  [
    'negotiation_amendment_reconciliations_suggested_docume_0c98b5',
    'negotiation_amendment_reconciliations',
    'suggested_document_version_id',
  ],
  [
    'negotiation_amendment_versions_authored_by_idx',
    'negotiation_amendment_versions',
    'authored_by',
  ],
  ['negotiation_amendments_author_id_idx', 'negotiation_amendments', 'author_id'],
  [
    'negotiation_amendments_target_project_version_id_idx',
    'negotiation_amendments',
    'target_project_version_id',
  ],
  ['negotiation_calls_source_version_id_idx', 'negotiation_calls', 'source_version_id'],
  [
    'negotiation_document_extractions_reviewed_by_idx',
    'negotiation_document_extractions',
    'reviewed_by',
  ],
  [
    'negotiation_document_versions_supersedes_version_id_idx',
    'negotiation_document_versions',
    'supersedes_version_id',
  ],
  ['negotiation_documents_source_id_idx', 'negotiation_documents', 'source_id'],
  ['negotiation_follows_track_id_idx', 'negotiation_follows', 'track_id'],
  [
    'negotiation_submission_evidence_source_version_id_idx',
    'negotiation_submission_evidence',
    'source_version_id',
  ],
  [
    'negotiation_submission_project_members_account_id_idx',
    'negotiation_submission_project_members',
    'account_id',
  ],
  [
    'negotiation_submission_project_members_added_by_idx',
    'negotiation_submission_project_members',
    'added_by',
  ],
  ['negotiation_submission_projects_call_id_idx', 'negotiation_submission_projects', 'call_id'],
  [
    'negotiation_submission_projects_legacy_submission_id_idx',
    'negotiation_submission_projects',
    'legacy_submission_id',
  ],
  [
    'negotiation_submission_versions_authored_by_idx',
    'negotiation_submission_versions',
    'authored_by',
  ],
  [
    'negotiation_submission_versions_base_version_id_idx',
    'negotiation_submission_versions',
    'base_version_id',
  ],
  [
    'negotiation_track_agenda_items_agenda_item_id_idx',
    'negotiation_track_agenda_items',
    'agenda_item_id',
  ],
  ['negotiation_track_calls_call_id_idx', 'negotiation_track_calls', 'call_id'],
  ['negotiation_track_documents_document_id_idx', 'negotiation_track_documents', 'document_id'],
  ['partnership_requests_reviewed_by_id_idx', 'partnership_requests', 'reviewed_by_id'],
  ['platform_bodies_published_by_idx', 'platform_bodies', 'published_by'],
  ['platform_bodies_updated_by_idx', 'platform_bodies', 'updated_by'],
  ['platform_contributions_author_id_idx', 'platform_contributions', 'author_id'],
  ['platform_contributions_decision_id_idx', 'platform_contributions', 'decision_id'],
  ['platform_contributions_resolved_by_idx', 'platform_contributions', 'resolved_by'],
  ['platform_decision_revisions_author_id_idx', 'platform_decision_revisions', 'author_id'],
  ['platform_decisions_author_id_idx', 'platform_decisions', 'author_id'],
  ['platform_enquiries_decision_id_idx', 'platform_enquiries', 'decision_id'],
  ['platform_enquiries_owner_id_idx', 'platform_enquiries', 'owner_id'],
  ['platform_tasks_body_id_idx', 'platform_tasks', 'body_id'],
  ['platform_tasks_created_by_idx', 'platform_tasks', 'created_by'],
  ['platform_tasks_decision_id_idx', 'platform_tasks', 'decision_id'],
  ['platform_tasks_owner_id_idx', 'platform_tasks', 'owner_id'],
  ['privacy_requests_handled_by_id_idx', 'privacy_requests', 'handled_by_id'],
  ['recognition_requests_reviewed_by_id_idx', 'recognition_requests', 'reviewed_by_id'],
  ['safeguarding_cases_assigned_to_id_idx', 'safeguarding_cases', 'assigned_to_id'],
  ['safeguarding_cases_updates_by_id_idx', 'safeguarding_cases_updates', 'by_id'],
  ['wg_activities_created_by_id_idx', 'wg_activities', 'created_by_id'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // plain CREATE INDEX: the migration runs in a transaction, and these tables are small
  for (const [index, table, column] of INDEXES) {
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "${index}" ON "${table}" ("${column}")`))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const [index] of INDEXES) {
    await db.execute(sql.raw(`DROP INDEX IF EXISTS "${index}"`))
  }
}
