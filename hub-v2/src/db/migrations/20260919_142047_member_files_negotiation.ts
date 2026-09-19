import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_accounts_principal_type" AS ENUM('human', 'service');
  CREATE TYPE "public"."enum_ngo_requests_kind" AS ENUM('submit', 'endorse', 'represent', 'deadline', 'other', 'badge_support');
  ALTER TABLE IF EXISTS "negotiation_tracks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "negotiation_projects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "negotiation_follows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS "negotiation_amendments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "negotiation_tracks" CASCADE;
  DROP TABLE IF EXISTS "negotiation_projects" CASCADE;
  DROP TABLE IF EXISTS "negotiation_follows" CASCADE;
  DROP TABLE IF EXISTS "negotiation_amendments" CASCADE;
  ALTER TABLE "member_profiles" DROP CONSTRAINT "member_profiles_photo_id_media_id_fk";
  
  ALTER TABLE "ngo_requests" DROP CONSTRAINT IF EXISTS "ngo_requests_decided_by_id_accounts_id_fk";
  
  ALTER TABLE "membership_appeals" DROP CONSTRAINT IF EXISTS "membership_appeals_proof_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_negotiation_tracks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_negotiation_projects_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_negotiation_follows_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_negotiation_amendments_fk";
  
  ALTER TABLE "ngo_requests" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "ngo_requests" ALTER COLUMN "status" SET DEFAULT 'open'::text;
  DROP TYPE "public"."enum_ngo_requests_status";
  CREATE TYPE "public"."enum_ngo_requests_status" AS ENUM('open', 'in_progress', 'done', 'declined');
  ALTER TABLE "ngo_requests" ALTER COLUMN "status" SET DEFAULT 'open'::"public"."enum_ngo_requests_status";
  ALTER TABLE "ngo_requests" ALTER COLUMN "status" SET DATA TYPE "public"."enum_ngo_requests_status" USING "status"::"public"."enum_ngo_requests_status";
  ALTER TABLE "membership_appeals" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "membership_appeals" ALTER COLUMN "status" SET DEFAULT 'submitted'::text;
  DROP TYPE "public"."enum_membership_appeals_status";
  CREATE TYPE "public"."enum_membership_appeals_status" AS ENUM('submitted', 'granted', 'upheld');
  ALTER TABLE "membership_appeals" ALTER COLUMN "status" SET DEFAULT 'submitted'::"public"."enum_membership_appeals_status";
  ALTER TABLE "membership_appeals" ALTER COLUMN "status" SET DATA TYPE "public"."enum_membership_appeals_status" USING "status"::"public"."enum_membership_appeals_status";
  DROP INDEX IF EXISTS "member_profiles_photo_idx";
  DROP INDEX IF EXISTS "ngo_requests_decided_by_idx";
  DROP INDEX IF EXISTS "membership_appeals_proof_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_negotiation_tracks_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_negotiation_projects_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_negotiation_follows_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_negotiation_amendments_id_idx";
  ALTER TABLE "ngo_requests" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_ngo_requests_kind" USING "kind"::"public"."enum_ngo_requests_kind";
  ALTER TABLE "ngo_requests" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "accounts" ADD COLUMN "youth_affiliation" varchar;
  ALTER TABLE "accounts" ADD COLUMN "accept_code_of_conduct" boolean DEFAULT false;
  ALTER TABLE "accounts" ADD COLUMN "accept_data_protection" boolean DEFAULT false;
  ALTER TABLE "accounts" ADD COLUMN "accept_principles" boolean DEFAULT false;
  ALTER TABLE "accounts" ADD COLUMN "accept_coi_policy" boolean DEFAULT false;
  ALTER TABLE "accounts" ADD COLUMN "verified_by" varchar;
  ALTER TABLE "accounts" ADD COLUMN "principal_type" "enum_accounts_principal_type" DEFAULT 'human';
  ALTER TABLE "ngo_requests" ADD COLUMN "deadline_at" timestamp(3) with time zone;
  ALTER TABLE "ngo_requests" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "ngo_requests" ADD CONSTRAINT "ngo_requests_created_by_id_accounts_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ngo_requests_created_by_idx" ON "ngo_requests" USING btree ("created_by_id");
  ALTER TABLE "member_profiles" DROP COLUMN IF EXISTS "photo_id";
  ALTER TABLE "ngo_requests" DROP COLUMN IF EXISTS "meta";
  ALTER TABLE "ngo_requests" DROP COLUMN IF EXISTS "decided_by_id";
  ALTER TABLE "ngo_requests" DROP COLUMN IF EXISTS "decided_at";
  ALTER TABLE "membership_appeals" DROP COLUMN IF EXISTS "proof_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "negotiation_tracks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "negotiation_projects_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "negotiation_follows_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "negotiation_amendments_id";

  -- Binary document proof bytes stay in bytea (never the public media store).
  ALTER TABLE "membership_appeals" ADD COLUMN "proof_bytes" bytea;

  -- Member profile photos, bytea storage (legacy migrations 024).
  CREATE TABLE IF NOT EXISTS "member_profile_photos" (
  	"account_id" integer PRIMARY KEY REFERENCES "accounts"("id") ON DELETE CASCADE,
  	"content_type" text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  	"bytes" bytea NOT NULL,
  	"byte_size" integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 786432),
  	"revision" integer NOT NULL DEFAULT 1,
  	"updated_by" integer REFERENCES "accounts"("id") ON DELETE SET NULL,
  	"updated_at" timestamptz NOT NULL DEFAULT now()
  );

  -- NGO contribution points ledger (legacy migration 013).
  CREATE TABLE IF NOT EXISTS "ngo_point_ledger" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"org_account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  	"points" integer NOT NULL CHECK (points <> 0),
  	"reason_code" text NOT NULL CHECK (reason_code IN (
  		'badge_support','unfccc_submission','endorse_document',
  		'submit_on_behalf','represent','other','adjustment')),
  	"title" text NOT NULL,
  	"note" text,
  	"related_type" text,
  	"related_id" text,
  	"awarded_by" integer REFERENCES "accounts"("id") ON DELETE SET NULL,
  	"status" text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','voided')),
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	"voided_at" timestamptz,
  	"voided_by" integer REFERENCES "accounts"("id") ON DELETE SET NULL,
  	"void_reason" text
  );
  CREATE INDEX IF NOT EXISTS "idx_ngo_point_ledger_org" ON "ngo_point_ledger" ("org_account_id","status","created_at" DESC);
  CREATE INDEX IF NOT EXISTS "idx_ngo_point_ledger_reason" ON "ngo_point_ledger" ("reason_code","created_at" DESC);
  CREATE INDEX IF NOT EXISTS "idx_ngo_point_ledger_related" ON "ngo_point_ledger" ("related_type","related_id") WHERE related_id IS NOT NULL;

  -- Negotiation tracking: tracks, agenda lineage, immutable source versions,
  -- verified calls, extraction review, follows (legacy migration 028).
  CREATE TABLE IF NOT EXISTS "negotiation_tracks" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"slug" text NOT NULL UNIQUE,
  	"topic" text NOT NULL,
  	"summary" text,
  	"activity_status" text NOT NULL DEFAULT 'active'
  		CHECK (activity_status IN ('active','watching','dormant','archived')),
  	"publication_status" text NOT NULL DEFAULT 'draft'
  		CHECK (publication_status IN ('draft','published','retracted')),
  	"published_at" timestamptz,
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	"updated_at" timestamptz NOT NULL DEFAULT now(),
  	CHECK (publication_status <> 'published' OR published_at IS NOT NULL)
  );
  CREATE TABLE IF NOT EXISTS "negotiation_track_working_groups" (
  	"track_id" uuid NOT NULL REFERENCES "negotiation_tracks"("id") ON DELETE CASCADE,
  	"working_group_slug" text NOT NULL,
  	PRIMARY KEY ("track_id","working_group_slug")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_agenda_items" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"body" text NOT NULL,
  	"session" text NOT NULL,
  	"item_number" text NOT NULL,
  	"sub_item_number" text,
  	"official_title" text NOT NULL,
  	"mandate_url" text,
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	UNIQUE ("body","session","item_number","sub_item_number")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_track_agenda_items" (
  	"track_id" uuid NOT NULL REFERENCES "negotiation_tracks"("id") ON DELETE CASCADE,
  	"agenda_item_id" uuid NOT NULL REFERENCES "negotiation_agenda_items"("id") ON DELETE RESTRICT,
  	PRIMARY KEY ("track_id","agenda_item_id")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_agenda_lineage" (
  	"from_agenda_item_id" uuid NOT NULL REFERENCES "negotiation_agenda_items"("id") ON DELETE RESTRICT,
  	"to_agenda_item_id" uuid NOT NULL REFERENCES "negotiation_agenda_items"("id") ON DELETE RESTRICT,
  	"evidence_note" text NOT NULL,
  	"source_version_id" uuid,
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	PRIMARY KEY ("from_agenda_item_id","to_agenda_item_id"),
  	CHECK (from_agenda_item_id <> to_agenda_item_id)
  );
  CREATE TABLE IF NOT EXISTS "negotiation_sources" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"source_url" text NOT NULL,
  	"source_kind" text NOT NULL CHECK (source_kind IN ('document','call','agenda','actor_publication')),
  	"permitted" boolean NOT NULL DEFAULT false,
  	"publication_status" text NOT NULL DEFAULT 'draft'
  		CHECK (publication_status IN ('draft','published','disabled')),
  	"last_successful_check_at" timestamptz,
  	"last_attempt_at" timestamptz,
  	"last_attempt_status" text CHECK (last_attempt_status IN ('succeeded','failed','blocked')),
  	"coverage_state" text NOT NULL DEFAULT 'unverified'
  		CHECK (coverage_state IN ('current','stale','incomplete','unverified')),
  	"safe_diagnostic" text,
  	"allowed_redirect_hosts" text[] NOT NULL DEFAULT '{}',
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	"updated_at" timestamptz NOT NULL DEFAULT now(),
  	UNIQUE ("source_url","source_kind")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_documents" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"source_id" uuid NOT NULL REFERENCES "negotiation_sources"("id") ON DELETE RESTRICT,
  	"source_identifier" text,
  	"title" text NOT NULL,
  	"document_type" text NOT NULL,
  	"document_status" text NOT NULL
  		CHECK (document_status IN ('unverified','informal','official','adopted','withdrawn')),
  	"status_verified" boolean NOT NULL DEFAULT false,
  	"body" text,
  	"session" text,
  	"publication_status" text NOT NULL DEFAULT 'draft'
  		CHECK (publication_status IN ('draft','published','retracted')),
  	"created_at" timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS "negotiation_document_versions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"document_id" uuid NOT NULL REFERENCES "negotiation_documents"("id") ON DELETE RESTRICT,
  	"content_hash" text NOT NULL,
  	"language" text NOT NULL,
  	"original_reference" text NOT NULL,
  	"final_source_url" text NOT NULL,
  	"media_type" text NOT NULL,
  	"content_size_bytes" integer NOT NULL CHECK (content_size_bytes >= 0),
  	"original_content" bytea NOT NULL,
  	"quarantine_status" text NOT NULL DEFAULT 'pending_review'
  		CHECK (quarantine_status IN ('pending_review','safe','quarantined')),
  	"quarantine_reason" text,
  	"extracted_text" text,
  	"published_at" timestamptz,
  	"retrieved_at" timestamptz NOT NULL,
  	"extraction_method" text NOT NULL,
  	"extraction_version" text NOT NULL,
  	"extraction_confidence" numeric(5,4),
  	"supersedes_version_id" uuid REFERENCES "negotiation_document_versions"("id") ON DELETE RESTRICT,
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	UNIQUE ("document_id","content_hash"),
  	CHECK (extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1)
  );
  ALTER TABLE "negotiation_agenda_lineage"
  	ADD CONSTRAINT "negotiation_agenda_lineage_source_version_fk"
  	FOREIGN KEY ("source_version_id") REFERENCES "negotiation_document_versions"("id") ON DELETE RESTRICT;
  CREATE TABLE IF NOT EXISTS "negotiation_track_documents" (
  	"track_id" uuid NOT NULL REFERENCES "negotiation_tracks"("id") ON DELETE CASCADE,
  	"document_id" uuid NOT NULL REFERENCES "negotiation_documents"("id") ON DELETE RESTRICT,
  	PRIMARY KEY ("track_id","document_id")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_document_extractions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"document_version_id" uuid NOT NULL REFERENCES "negotiation_document_versions"("id") ON DELETE RESTRICT,
  	"revision" integer NOT NULL CHECK (revision > 0),
  	"content_hash" text NOT NULL,
  	"text_content" text,
  	"extraction_method" text NOT NULL,
  	"extraction_confidence" numeric(5,4),
  	"review_status" text NOT NULL CHECK (review_status IN ('safe','quarantined')),
  	"reason_codes" text[] NOT NULL DEFAULT '{}',
  	"reviewed_by" integer NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
  	"review_note" text NOT NULL,
  	"reviewed_at" timestamptz NOT NULL DEFAULT now(),
  	UNIQUE ("document_version_id","revision"),
  	CHECK (extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1),
  	CHECK ((review_status='safe' AND text_content IS NOT NULL)
  		OR (review_status='quarantined' AND text_content IS NULL))
  );
  CREATE INDEX IF NOT EXISTS "idx_negotiation_extractions_version"
  	ON "negotiation_document_extractions" ("document_version_id","revision" DESC);
  CREATE TABLE IF NOT EXISTS "negotiation_calls" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"title" text NOT NULL,
  	"mandate" text NOT NULL,
  	"eligibility" text NOT NULL,
  	"submitting_channel" text,
  	"source_version_id" uuid NOT NULL REFERENCES "negotiation_document_versions"("id") ON DELETE RESTRICT,
  	"status" text NOT NULL CHECK (status IN ('unverified','open','amended','closed','withdrawn')),
  	"external_deadline_date" date,
  	"external_deadline_time" time,
  	"external_deadline_timezone" text,
  	"external_deadline_precision" text NOT NULL
  		CHECK (external_deadline_precision IN ('unspecified','date','time')),
  	"publication_status" text NOT NULL DEFAULT 'draft'
  		CHECK (publication_status IN ('draft','published','retracted')),
  	"published_at" timestamptz,
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	"updated_at" timestamptz NOT NULL DEFAULT now(),
  	CHECK (external_deadline_precision <> 'time' OR (external_deadline_time IS NOT NULL AND external_deadline_timezone IS NOT NULL)),
  	CHECK (external_deadline_precision <> 'date' OR external_deadline_time IS NULL),
  	CHECK (publication_status <> 'published' OR published_at IS NOT NULL)
  );
  CREATE TABLE IF NOT EXISTS "negotiation_track_calls" (
  	"track_id" uuid NOT NULL REFERENCES "negotiation_tracks"("id") ON DELETE CASCADE,
  	"call_id" uuid NOT NULL REFERENCES "negotiation_calls"("id") ON DELETE RESTRICT,
  	PRIMARY KEY ("track_id","call_id")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_follows" (
  	"account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  	"track_id" uuid NOT NULL REFERENCES "negotiation_tracks"("id") ON DELETE CASCADE,
  	"deadline_alerts" boolean NOT NULL DEFAULT true,
  	"substantive_change_alerts" boolean NOT NULL DEFAULT true,
  	"digest_frequency" text NOT NULL DEFAULT 'weekly'
  		CHECK (digest_frequency IN ('none','daily','weekly')),
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	"updated_at" timestamptz NOT NULL DEFAULT now(),
  	PRIMARY KEY ("account_id","track_id")
  );
  CREATE INDEX IF NOT EXISTS "idx_negotiation_tracks_public"
  	ON "negotiation_tracks" ("activity_status","topic")
  	WHERE publication_status = 'published';
  CREATE INDEX IF NOT EXISTS "idx_negotiation_agenda_session"
  	ON "negotiation_agenda_items" ("body","session","item_number");
  CREATE INDEX IF NOT EXISTS "idx_negotiation_document_versions_document"
  	ON "negotiation_document_versions" ("document_id","retrieved_at" DESC);
  CREATE INDEX IF NOT EXISTS "idx_negotiation_calls_public_deadline"
  	ON "negotiation_calls" ("external_deadline_date")
  	WHERE publication_status = 'published';
  CREATE INDEX IF NOT EXISTS "idx_negotiation_follows_account"
  	ON "negotiation_follows" ("account_id","updated_at" DESC);

  -- Member drafting projects, immutable versions, exact-version amendments
  -- (legacy migration 029).
  CREATE TABLE IF NOT EXISTS "negotiation_mutation_idempotency" (
  	"actor_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  	"operation" text NOT NULL,
  	"idempotency_key" text NOT NULL,
  	"request_hash" text NOT NULL,
  	"response_payload" jsonb NOT NULL,
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	PRIMARY KEY ("actor_id","operation","idempotency_key")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_submission_projects" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"legacy_submission_id" integer REFERENCES "content_submissions"("id") ON DELETE SET NULL,
  	"track_id" uuid NOT NULL REFERENCES "negotiation_tracks"("id") ON DELETE RESTRICT,
  	"call_id" uuid REFERENCES "negotiation_calls"("id") ON DELETE RESTRICT,
  	"title" text NOT NULL,
  	"purpose" text NOT NULL,
  	"working_group_slug" text,
  	"intended_submitting_entity" text,
  	"external_draft_url" text,
  	"is_initiative" boolean NOT NULL,
  	"lifecycle_status" text NOT NULL DEFAULT 'proposal' CHECK (lifecycle_status IN (
  		'proposal','triage','drafting','consultation','endorsement_pending',
  		'endorsed','ready_for_transmission','transmitted','changes_requested',
  		'declined','withdrawn','closed','superseded')),
  	"visibility" text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','project_team')),
  	"created_by" integer NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
  	"current_version" integer NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	"updated_at" timestamptz NOT NULL DEFAULT now(),
  	CHECK (call_id IS NOT NULL OR is_initiative = true),
  	CHECK (call_id IS NULL OR is_initiative = false)
  );
  CREATE TABLE IF NOT EXISTS "negotiation_submission_project_members" (
  	"project_id" uuid NOT NULL REFERENCES "negotiation_submission_projects"("id") ON DELETE CASCADE,
  	"account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  	"role" text NOT NULL CHECK (role IN ('owner','contributor','viewer')),
  	"added_by" integer NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	PRIMARY KEY ("project_id","account_id")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_submission_versions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"project_id" uuid NOT NULL REFERENCES "negotiation_submission_projects"("id") ON DELETE RESTRICT,
  	"version" integer NOT NULL CHECK (version > 0),
  	"base_version_id" uuid REFERENCES "negotiation_submission_versions"("id") ON DELETE RESTRICT,
  	"content_text" text NOT NULL,
  	"content_hash" text NOT NULL,
  	"external_snapshot_url" text,
  	"authored_by" integer NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	UNIQUE ("project_id","version"),
  	UNIQUE ("project_id","content_hash")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_submission_evidence" (
  	"project_version_id" uuid NOT NULL REFERENCES "negotiation_submission_versions"("id") ON DELETE RESTRICT,
  	"source_version_id" uuid NOT NULL REFERENCES "negotiation_document_versions"("id") ON DELETE RESTRICT,
  	"location" jsonb NOT NULL,
  	"quote" text,
  	PRIMARY KEY ("project_version_id","source_version_id","location")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_amendments" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"project_id" uuid REFERENCES "negotiation_submission_projects"("id") ON DELETE RESTRICT,
  	"target_type" text NOT NULL CHECK (target_type IN ('official_document','internal_draft')),
  	"target_document_version_id" uuid REFERENCES "negotiation_document_versions"("id") ON DELETE RESTRICT,
  	"target_project_version_id" uuid REFERENCES "negotiation_submission_versions"("id") ON DELETE RESTRICT,
  	"stable_anchor" jsonb NOT NULL,
  	"operation" text NOT NULL CHECK (operation IN ('insert','replace','delete')),
  	"original_text" text NOT NULL,
  	"proposed_text" text,
  	"rationale" text NOT NULL,
  	"decision_status" text NOT NULL DEFAULT 'draft' CHECK (decision_status IN (
  		'draft','proposed','discussion','accepted_into_draft',
  		'changes_requested','declined','withdrawn')),
  	"reconciliation_status" text NOT NULL DEFAULT 'anchored'
  		CHECK (reconciliation_status IN ('anchored','mapping_suggested','needs_reconciliation','confirmed')),
  	"author_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
  	"current_version" integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	"updated_at" timestamptz NOT NULL DEFAULT now(),
  	CHECK ((target_type='official_document' AND target_document_version_id IS NOT NULL AND target_project_version_id IS NULL)
  		OR (target_type='internal_draft' AND target_project_version_id IS NOT NULL AND target_document_version_id IS NULL)),
  	CHECK (operation <> 'delete' OR proposed_text IS NULL),
  	CHECK (operation = 'delete' OR proposed_text IS NOT NULL)
  );
  CREATE TABLE IF NOT EXISTS "negotiation_amendment_versions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"amendment_id" uuid NOT NULL REFERENCES "negotiation_amendments"("id") ON DELETE RESTRICT,
  	"version" integer NOT NULL CHECK (version > 0),
  	"content_hash" text NOT NULL,
  	"operation" text NOT NULL CHECK (operation IN ('insert','replace','delete')),
  	"original_text" text NOT NULL,
  	"proposed_text" text,
  	"rationale" text NOT NULL,
  	"stable_anchor" jsonb NOT NULL,
  	"authored_by" integer NOT NULL REFERENCES "accounts"("id") ON DELETE RESTRICT,
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	UNIQUE ("amendment_id","version")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_amendment_evidence" (
  	"amendment_version_id" uuid NOT NULL REFERENCES "negotiation_amendment_versions"("id") ON DELETE RESTRICT,
  	"source_version_id" uuid NOT NULL REFERENCES "negotiation_document_versions"("id") ON DELETE RESTRICT,
  	"location" jsonb NOT NULL,
  	"quote" text,
  	PRIMARY KEY ("amendment_version_id","source_version_id","location")
  );
  CREATE TABLE IF NOT EXISTS "negotiation_amendment_reconciliations" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  	"amendment_id" uuid NOT NULL REFERENCES "negotiation_amendments"("id") ON DELETE RESTRICT,
  	"from_document_version_id" uuid NOT NULL REFERENCES "negotiation_document_versions"("id") ON DELETE RESTRICT,
  	"suggested_document_version_id" uuid NOT NULL REFERENCES "negotiation_document_versions"("id") ON DELETE RESTRICT,
  	"suggested_anchor" jsonb NOT NULL,
  	"mapping_evidence" jsonb NOT NULL,
  	"confidence" numeric(5,4),
  	"status" text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','confirmed','rejected')),
  	"confirmed_by" integer REFERENCES "accounts"("id") ON DELETE RESTRICT,
  	"confirmed_at" timestamptz,
  	"created_at" timestamptz NOT NULL DEFAULT now(),
  	CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  	CHECK (status <> 'confirmed' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
  );
  CREATE INDEX IF NOT EXISTS "idx_negotiation_projects_owner"
  	ON "negotiation_submission_projects" ("created_by","updated_at" DESC);
  CREATE INDEX IF NOT EXISTS "idx_negotiation_projects_track"
  	ON "negotiation_submission_projects" ("track_id","lifecycle_status","updated_at" DESC);
  CREATE INDEX IF NOT EXISTS "idx_negotiation_versions_project"
  	ON "negotiation_submission_versions" ("project_id","version" DESC);
  CREATE INDEX IF NOT EXISTS "idx_negotiation_amendments_project"
  	ON "negotiation_amendments" ("project_id","updated_at" DESC);
  CREATE INDEX IF NOT EXISTS "idx_negotiation_amendments_document_target"
  	ON "negotiation_amendments" ("target_document_version_id")
  	WHERE target_type='official_document';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "negotiation_tracks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"topic" varchar NOT NULL,
  	"summary" varchar,
  	"activity_status" varchar,
  	"working_group_slugs" jsonb,
  	"published" boolean DEFAULT false,
  	"agenda_items" jsonb,
  	"calls" jsonb,
  	"documents" jsonb,
  	"notice" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "negotiation_projects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"track_slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"summary" varchar,
  	"status" varchar DEFAULT 'open',
  	"scope" jsonb,
  	"created_by_id" integer,
  	"versions" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "negotiation_follows" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"track_slug" varchar NOT NULL,
  	"preferences" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "negotiation_amendments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"track_slug" varchar,
  	"project_id" varchar,
  	"title" varchar,
  	"kind" varchar,
  	"status" varchar DEFAULT 'draft',
  	"text" varchar,
  	"rationale" varchar,
  	"citations" jsonb,
  	"submitted_by_id" integer,
  	"versions" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "ngo_requests" DROP CONSTRAINT "ngo_requests_created_by_id_accounts_id_fk";
  
  ALTER TABLE "ngo_requests" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "ngo_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_ngo_requests_status";
  CREATE TYPE "public"."enum_ngo_requests_status" AS ENUM('pending', 'approved', 'declined');
  ALTER TABLE "ngo_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."enum_ngo_requests_status";
  ALTER TABLE "ngo_requests" ALTER COLUMN "status" SET DATA TYPE "public"."enum_ngo_requests_status" USING "status"::"public"."enum_ngo_requests_status";
  ALTER TABLE "membership_appeals" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "membership_appeals" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_membership_appeals_status";
  CREATE TYPE "public"."enum_membership_appeals_status" AS ENUM('pending', 'approved', 'declined');
  ALTER TABLE "membership_appeals" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."enum_membership_appeals_status";
  ALTER TABLE "membership_appeals" ALTER COLUMN "status" SET DATA TYPE "public"."enum_membership_appeals_status" USING "status"::"public"."enum_membership_appeals_status";
  DROP INDEX "ngo_requests_created_by_idx";
  ALTER TABLE "ngo_requests" ALTER COLUMN "kind" SET DATA TYPE varchar;
  ALTER TABLE "ngo_requests" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "member_profiles" ADD COLUMN "photo_id" integer;
  ALTER TABLE "ngo_requests" ADD COLUMN "meta" jsonb;
  ALTER TABLE "ngo_requests" ADD COLUMN "decided_by_id" integer;
  ALTER TABLE "ngo_requests" ADD COLUMN "decided_at" timestamp(3) with time zone;
  ALTER TABLE "membership_appeals" ADD COLUMN "proof_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "negotiation_tracks_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "negotiation_projects_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "negotiation_follows_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "negotiation_amendments_id" integer;
  ALTER TABLE "negotiation_projects" ADD CONSTRAINT "negotiation_projects_created_by_id_accounts_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "negotiation_follows" ADD CONSTRAINT "negotiation_follows_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "negotiation_amendments" ADD CONSTRAINT "negotiation_amendments_submitted_by_id_accounts_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "negotiation_tracks_slug_idx" ON "negotiation_tracks" USING btree ("slug");
  CREATE INDEX "negotiation_tracks_activity_status_idx" ON "negotiation_tracks" USING btree ("activity_status");
  CREATE INDEX "negotiation_tracks_published_idx" ON "negotiation_tracks" USING btree ("published");
  CREATE INDEX "negotiation_tracks_updated_at_idx" ON "negotiation_tracks" USING btree ("updated_at");
  CREATE INDEX "negotiation_tracks_created_at_idx" ON "negotiation_tracks" USING btree ("created_at");
  CREATE INDEX "negotiation_projects_track_slug_idx" ON "negotiation_projects" USING btree ("track_slug");
  CREATE INDEX "negotiation_projects_status_idx" ON "negotiation_projects" USING btree ("status");
  CREATE INDEX "negotiation_projects_created_by_idx" ON "negotiation_projects" USING btree ("created_by_id");
  CREATE INDEX "negotiation_projects_updated_at_idx" ON "negotiation_projects" USING btree ("updated_at");
  CREATE INDEX "negotiation_projects_created_at_idx" ON "negotiation_projects" USING btree ("created_at");
  CREATE INDEX "negotiation_follows_account_idx" ON "negotiation_follows" USING btree ("account_id");
  CREATE INDEX "negotiation_follows_track_slug_idx" ON "negotiation_follows" USING btree ("track_slug");
  CREATE INDEX "negotiation_follows_updated_at_idx" ON "negotiation_follows" USING btree ("updated_at");
  CREATE INDEX "negotiation_follows_created_at_idx" ON "negotiation_follows" USING btree ("created_at");
  CREATE INDEX "negotiation_amendments_track_slug_idx" ON "negotiation_amendments" USING btree ("track_slug");
  CREATE INDEX "negotiation_amendments_submitted_by_idx" ON "negotiation_amendments" USING btree ("submitted_by_id");
  CREATE INDEX "negotiation_amendments_updated_at_idx" ON "negotiation_amendments" USING btree ("updated_at");
  CREATE INDEX "negotiation_amendments_created_at_idx" ON "negotiation_amendments" USING btree ("created_at");
  ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ngo_requests" ADD CONSTRAINT "ngo_requests_decided_by_id_accounts_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "membership_appeals" ADD CONSTRAINT "membership_appeals_proof_id_media_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_negotiation_tracks_fk" FOREIGN KEY ("negotiation_tracks_id") REFERENCES "public"."negotiation_tracks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_negotiation_projects_fk" FOREIGN KEY ("negotiation_projects_id") REFERENCES "public"."negotiation_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_negotiation_follows_fk" FOREIGN KEY ("negotiation_follows_id") REFERENCES "public"."negotiation_follows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_negotiation_amendments_fk" FOREIGN KEY ("negotiation_amendments_id") REFERENCES "public"."negotiation_amendments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "member_profiles_photo_idx" ON "member_profiles" USING btree ("photo_id");
  CREATE INDEX "ngo_requests_decided_by_idx" ON "ngo_requests" USING btree ("decided_by_id");
  CREATE INDEX "membership_appeals_proof_idx" ON "membership_appeals" USING btree ("proof_id");
  CREATE INDEX "payload_locked_documents_rels_negotiation_tracks_id_idx" ON "payload_locked_documents_rels" USING btree ("negotiation_tracks_id");
  CREATE INDEX "payload_locked_documents_rels_negotiation_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("negotiation_projects_id");
  CREATE INDEX "payload_locked_documents_rels_negotiation_follows_id_idx" ON "payload_locked_documents_rels" USING btree ("negotiation_follows_id");
  CREATE INDEX "payload_locked_documents_rels_negotiation_amendments_id_idx" ON "payload_locked_documents_rels" USING btree ("negotiation_amendments_id");
  ALTER TABLE "accounts" DROP COLUMN "youth_affiliation";
  ALTER TABLE "accounts" DROP COLUMN "accept_code_of_conduct";
  ALTER TABLE "accounts" DROP COLUMN "accept_data_protection";
  ALTER TABLE "accounts" DROP COLUMN "accept_principles";
  ALTER TABLE "accounts" DROP COLUMN "accept_coi_policy";
  ALTER TABLE "accounts" DROP COLUMN "verified_by";
  ALTER TABLE "accounts" DROP COLUMN "principal_type";
  ALTER TABLE "ngo_requests" DROP COLUMN "deadline_at";
  ALTER TABLE "ngo_requests" DROP COLUMN "created_by_id";
  DROP TYPE "public"."enum_accounts_principal_type";
  DROP TYPE "public"."enum_ngo_requests_kind";

  ALTER TABLE "membership_appeals" DROP COLUMN IF EXISTS "proof_bytes";
  DROP TABLE IF EXISTS "member_profile_photos" CASCADE;
  DROP TABLE IF EXISTS "ngo_point_ledger" CASCADE;
  DROP TABLE IF EXISTS "negotiation_mutation_idempotency" CASCADE;
  DROP TABLE IF EXISTS "negotiation_submission_project_members" CASCADE;
  DROP TABLE IF EXISTS "negotiation_submission_evidence" CASCADE;
  DROP TABLE IF EXISTS "negotiation_submission_versions" CASCADE;
  DROP TABLE IF EXISTS "negotiation_amendment_evidence" CASCADE;
  DROP TABLE IF EXISTS "negotiation_amendment_versions" CASCADE;
  DROP TABLE IF EXISTS "negotiation_amendment_reconciliations" CASCADE;
  DROP TABLE IF EXISTS "negotiation_amendments" CASCADE;
  DROP TABLE IF EXISTS "negotiation_submission_projects" CASCADE;
  DROP TABLE IF EXISTS "negotiation_follows" CASCADE;
  DROP TABLE IF EXISTS "negotiation_track_calls" CASCADE;
  DROP TABLE IF EXISTS "negotiation_calls" CASCADE;
  DROP TABLE IF EXISTS "negotiation_document_extractions" CASCADE;
  DROP TABLE IF EXISTS "negotiation_track_documents" CASCADE;
  DROP TABLE IF EXISTS "negotiation_document_versions" CASCADE;
  DROP TABLE IF EXISTS "negotiation_documents" CASCADE;
  DROP TABLE IF EXISTS "negotiation_sources" CASCADE;
  DROP TABLE IF EXISTS "negotiation_agenda_lineage" CASCADE;
  DROP TABLE IF EXISTS "negotiation_track_agenda_items" CASCADE;
  DROP TABLE IF EXISTS "negotiation_agenda_items" CASCADE;
  DROP TABLE IF EXISTS "negotiation_track_working_groups" CASCADE;
  DROP TABLE IF EXISTS "negotiation_tracks" CASCADE;`)
}
