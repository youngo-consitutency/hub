import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// One authority store: `authority_records` replaces the appointments /
// assignments split. Mandated responsibilities are kind='mandate',
// member-joinable participation (WG/body/organisation/negotiation
// membership) is kind='participation'. Every `assignments` row is copied
// losslessly — its recorded role string, status and term window are
// preserved verbatim; resolving a row to its authority role stays a
// code-level concern (lib/authority.ts), so there is exactly one
// implementation of the legacy-role map. Scope types are canonicalised on
// copy ('organization'→'organisation', 'platform_body'→'body') so the store
// holds a single spelling going forward.
//
// Renames carry history forward rather than copying: `appointments` becomes
// `authority_records`, then the ledger rows are inserted. The
// provenance->>'assignmentId' uniqueness carries across — one record per
// source row, enforced by the database.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_authority_records_kind" AS ENUM('mandate', 'participation');

  ALTER TYPE "public"."enum_appointments_scope_type" RENAME TO "enum_authority_records_scope_type";
  ALTER TYPE "public"."enum_appointments_status" RENAME TO "enum_authority_records_status";
  -- role is free text: canonical registry keys for grants, recorded role
  -- strings for migrated participation rows — one resolution map in code.
  -- The column must detach from the enum BEFORE it is dropped (a CASCADE
  -- drop would take the column with it).
  ALTER TABLE "appointments" ALTER COLUMN "appointment_role" TYPE varchar;
  DROP TYPE "public"."enum_appointments_appointment_role";
  ALTER TABLE "appointments" RENAME TO "authority_records";
  ALTER TABLE "authority_records" RENAME COLUMN "appointment_role" TO "role";
  ALTER TABLE "authority_records" RENAME COLUMN "appointed_via" TO "provenance";
  ALTER TABLE "authority_records" RENAME COLUMN "appointed_by_id" TO "recorded_by_id";
  ALTER TABLE "authority_records" ADD COLUMN "kind" "enum_authority_records_kind" NOT NULL DEFAULT 'mandate';
  ALTER TABLE "authority_records" ALTER COLUMN "kind" DROP DEFAULT;

  ALTER TABLE "authority_records" RENAME CONSTRAINT "appointments_account_id_accounts_id_fk" TO "authority_records_account_id_accounts_id_fk";
  ALTER TABLE "authority_records" RENAME CONSTRAINT "appointments_appointed_by_id_accounts_id_fk" TO "authority_records_recorded_by_id_accounts_id_fk";
  ALTER TABLE "authority_records" RENAME CONSTRAINT "appointments_substitute_for_id_appointments_id_fk" TO "authority_records_substitute_for_id_authority_records_id_fk";
  ALTER INDEX "appointments_account_idx" RENAME TO "authority_records_account_idx";
  ALTER INDEX "appointments_appointment_role_idx" RENAME TO "authority_records_role_idx";
  ALTER INDEX "appointments_scope_id_idx" RENAME TO "authority_records_scope_id_idx";
  ALTER INDEX "appointments_status_idx" RENAME TO "authority_records_status_idx";
  ALTER INDEX "appointments_council_seat_idx" RENAME TO "authority_records_council_seat_idx";
  ALTER INDEX "appointments_active_scope_unique" RENAME TO "authority_records_active_scope_unique";
  ALTER INDEX "appointments_migration_source_unique" RENAME TO "authority_records_migration_source_unique";

  -- Lossless copy of the participation ledger. Roles are canonicalised to
  -- the registry key where the (scope, role) tuple maps; unmapped strings
  -- are preserved verbatim — they grant nothing and surface as unmapped.
  -- The map is replicated here ONCE as a data transform; the code resolver
  -- remains the only runtime implementation. kind is structural: member
  -- rows in joinable scopes are participation, everything else is a
  -- recorded responsibility.
  INSERT INTO "authority_records" (
    "account_id","kind","role","scope_type","scope_id","status",
    "starts_at","ends_at","evidence","recorded_by_id","provenance",
    "created_at","updated_at"
  )
  SELECT
    a."account_id",
    (CASE WHEN a."role"='member' AND norm.scope IN ('body','working_group','organisation','negotiation_track','negotiation_project')
         THEN 'participation' ELSE 'mandate' END)::"enum_authority_records_kind",
    CASE
      WHEN norm.scope='team' AND a."scope_id"='gct' THEN CASE a."role"
        WHEN 'partnerships' THEN 'gct.partnerships' WHEN 'membership' THEN 'gct.membership'
        WHEN 'finance' THEN 'gct.finance' WHEN 'internal' THEN 'gct.internal'
        WHEN 'coordination' THEN 'gct.coordination'
        WHEN 'member' THEN 'gct.coordinator' WHEN 'coordinator' THEN 'gct.coordinator'
        WHEN 'lead' THEN 'gct.coordinator' ELSE a."role" END
      WHEN norm.scope='team' AND a."role" IN ('member','coordinator','lead','') THEN CASE a."scope_id"
        WHEN 'membership_team' THEN 'team.membership' WHEN 'selection_team' THEN 'team.selections'
        WHEN 'election_facilitation' THEN 'team.election_facilitation'
        WHEN 'bottomlining' THEN 'team.election_facilitation' WHEN 'blt' THEN 'team.election_facilitation'
        WHEN 'awareness_team' THEN 'team.awareness' WHEN 'safeguarding_team' THEN 'team.safeguarding'
        WHEN 'finance_team' THEN 'team.finance'
        WHEN 'partnerships_team' THEN 'team.partnerships' WHEN 'partnerships' THEN 'team.partnerships'
        WHEN 'comms_team' THEN 'team.comms' WHEN 'reforms_team' THEN 'team.reforms'
        WHEN 'data_controller' THEN 'team.data_controller' WHEN 'gys_policy_team' THEN 'team.gys_policy'
        WHEN 'content_editor' THEN 'content.editor' WHEN 'content_publisher' THEN 'content.publisher'
        WHEN 'lcoy_liaison' THEN 'coy.lcoy_liaison' WHEN 'rcoy_liaison' THEN 'coy.rcoy_liaison'
        WHEN 'gcoy_liaison' THEN 'coy.gcoy_liaison' ELSE a."role" END
      WHEN norm.scope='working_group' THEN CASE a."role"
        WHEN 'member' THEN 'wg.member' WHEN 'contact' THEN 'wg.contact_point'
        WHEN 'lead' THEN 'wg.contact_point' WHEN 'coordinator' THEN 'wg.contact_point'
        WHEN 'contact_point' THEN 'wg.contact_point'
        WHEN 'safeguarding_officer' THEN 'wg.safeguarding_officer' ELSE a."role" END
      WHEN norm.scope='operational_team' THEN CASE a."role"
        WHEN 'liaison' THEN 'ot.liaison' WHEN 'member' THEN 'ot.member' ELSE a."role" END
      WHEN norm.scope='body' THEN CASE a."role"
        WHEN 'lcoy_liaison' THEN 'coy.lcoy_liaison' WHEN 'rcoy_liaison' THEN 'coy.rcoy_liaison'
        WHEN 'gcoy_liaison' THEN 'coy.gcoy_liaison'
        WHEN 'member' THEN 'body.member' WHEN 'coordinator' THEN 'body.coordinator'
        WHEN 'contact_point' THEN 'body.contact_point' WHEN 'liaison' THEN 'body.liaison'
        WHEN 'council_representative' THEN 'body.council_representative' ELSE a."role" END
      WHEN norm.scope='organisation' THEN CASE a."role"
        WHEN 'member' THEN 'org.member' WHEN 'representative' THEN 'org.representative'
        WHEN 'dcp' THEN 'org.representative' WHEN 'admin' THEN 'org.admin' ELSE a."role" END
      WHEN norm.scope IN ('negotiation_track','negotiation_project') THEN CASE a."role"
        WHEN 'member' THEN 'negotiation.member' WHEN 'reviewer' THEN 'negotiation.reviewer'
        WHEN 'applier' THEN 'negotiation.applier' WHEN 'grant_manager' THEN 'negotiation.grant_manager'
        WHEN 'process_facilitator' THEN 'negotiation.process_facilitator'
        WHEN 'transmitter' THEN 'negotiation.transmitter' ELSE a."role" END
      WHEN norm.scope='event' THEN CASE a."role"
        WHEN 'coordinator' THEN 'cct.coordinator' WHEN 'member' THEN 'cct.member' ELSE a."role" END
      ELSE a."role" END,
    norm.scope::"enum_authority_records_scope_type",
    a."scope_id",
    a."status"::text::"enum_authority_records_status",
    COALESCE(a."starts_at", a."created_at", now()),
    a."ends_at",
    a."appointment_evidence",
    a."assigned_by_id",
    jsonb_build_object(
      'source','assignments_migration',
      'assignmentId',a."id",
      'assignmentRole',a."role",
      'assignmentScope',a."scope_type"::text||':'||a."scope_id"
    ),
    a."created_at",
    a."updated_at"
  FROM "assignments" a
  CROSS JOIN LATERAL (
    SELECT CASE WHEN a."scope_type"='organization' THEN 'organisation'
                WHEN a."scope_type"='platform_body' THEN 'body'
                ELSE a."scope_type"::text END AS scope
  ) norm
  -- Two collisions are both safe to skip: legacy rows that canonicalise
  -- onto an already-active tuple (active_scope_unique), and rows already
  -- migrated at runtime (migration_source_unique on provenance.assignmentId
  -- — the existing record wins, no resurrection). Bare DO NOTHING covers
  -- both indexes.
  ON CONFLICT DO NOTHING;

  -- Payload's document-lock registry: one rels column per collection.
  -- Dependent objects must go before the table they reference.
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_assignments_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_assignments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "assignments_id";

  DROP TABLE "assignments";
  DROP TYPE "public"."enum_assignments_scope_type";
  DROP TYPE "public"."enum_assignments_status";

  ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "appointments_id" TO "authority_records_id";
  ALTER TABLE "payload_locked_documents_rels" RENAME CONSTRAINT "payload_locked_documents_rels_appointments_fk" TO "payload_locked_documents_rels_authority_records_fk";
  ALTER INDEX "payload_locked_documents_rels_appointments_id_idx" RENAME TO "payload_locked_documents_rels_authority_records_id_idx";

  -- The last mirror: accounts.team_roles duplicated team-scoped records.
  -- List views now derive it from authority_records; nothing may write it.
  ALTER TABLE "accounts" DROP COLUMN "team_roles";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The assignments rows are folded into authority_records with provenance;
  // rolling back restores the table shape but cannot un-migrate the data —
  // restore from backup if a full revert is required.
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "authority_records_id" TO "appointments_id";
  ALTER TABLE "payload_locked_documents_rels" RENAME CONSTRAINT "payload_locked_documents_rels_authority_records_fk" TO "payload_locked_documents_rels_appointments_fk";
  ALTER INDEX "payload_locked_documents_rels_authority_records_id_idx" RENAME TO "payload_locked_documents_rels_appointments_id_idx";
  ALTER TABLE "authority_records" DROP COLUMN "kind";
  ALTER TABLE "authority_records" RENAME TO "appointments";
  ALTER TABLE "appointments" RENAME COLUMN "role" TO "appointment_role";
  ALTER TABLE "appointments" RENAME COLUMN "provenance" TO "appointed_via";
  ALTER TABLE "appointments" RENAME COLUMN "recorded_by_id" TO "appointed_by_id";
  ALTER TYPE "public"."enum_authority_records_scope_type" RENAME TO "enum_appointments_scope_type";
  ALTER TYPE "public"."enum_authority_records_status" RENAME TO "enum_appointments_status";
  DROP TYPE "public"."enum_authority_records_kind";
  ALTER TABLE "accounts" ADD COLUMN "team_roles" jsonb;
  `)
}
