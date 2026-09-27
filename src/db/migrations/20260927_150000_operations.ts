import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Operational workflow tables: funding (S12), safeguarding (S23/S04), COI
// (S07), recognition (S20), partnerships (S13), privacy requests (S08).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_funding_requests_category" AS ENUM('event_travel', 'project', 'operations', 'other');
  CREATE TYPE "public"."enum_funding_requests_status" AS ENUM('submitted', 'under_review', 'approved', 'rejected', 'disbursed', 'reported', 'cancelled');
  CREATE TYPE "public"."enum_safeguarding_cases_kind" AS ENUM('safeguarding', 'child_safeguarding', 'concern', 'coc');
  CREATE TYPE "public"."enum_safeguarding_cases_severity" AS ENUM('low', 'medium', 'high', 'critical');
  CREATE TYPE "public"."enum_safeguarding_cases_status" AS ENUM('received', 'triaged', 'investigating', 'resolved', 'closed');
  CREATE TYPE "public"."enum_coi_declarations_status" AS ENUM('declared', 'under_review', 'resolved', 'dismissed');
  CREATE TYPE "public"."enum_recognition_requests_kind" AS ENUM('certificate', 'letter', 'other');
  CREATE TYPE "public"."enum_recognition_requests_status" AS ENUM('requested', 'approved', 'issued', 'declined');
  CREATE TYPE "public"."enum_partnership_requests_kind" AS ENUM('partnership', 'sponsorship', 'mou', 'other');
  CREATE TYPE "public"."enum_partnership_requests_status" AS ENUM('proposed', 'under_review', 'approved', 'active', 'declined', 'ended');
  CREATE TYPE "public"."enum_privacy_requests_kind" AS ENUM('access', 'erasure', 'rectification', 'portability', 'objection');
  CREATE TYPE "public"."enum_privacy_requests_status" AS ENUM('received', 'in_progress', 'fulfilled', 'declined');

  CREATE TABLE "funding_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"purpose" varchar NOT NULL,
  	"amount_numeric" numeric NOT NULL,
  	"currency" varchar DEFAULT 'EUR' NOT NULL,
  	"category" "enum_funding_requests_category" NOT NULL,
  	"period_start" timestamp(3) with time zone,
  	"period_end" timestamp(3) with time zone,
  	"status" "enum_funding_requests_status" DEFAULT 'submitted' NOT NULL,
  	"review_note" varchar,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"disbursed_at" timestamp(3) with time zone,
  	"report_note" varchar,
  	"reported_at" timestamp(3) with time zone,
  	"submitted_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "safeguarding_cases" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reporter_id" integer,
  	"anonymous" boolean DEFAULT false,
  	"kind" "enum_safeguarding_cases_kind" NOT NULL,
  	"severity" "enum_safeguarding_cases_severity" DEFAULT 'medium' NOT NULL,
  	"description" varchar NOT NULL,
  	"involved_parties" jsonb,
  	"status" "enum_safeguarding_cases_status" DEFAULT 'received' NOT NULL,
  	"assigned_to_id" integer,
  	"outcome_note" varchar,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"closed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "safeguarding_cases_updates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"note" varchar NOT NULL,
  	"status" varchar,
  	"by_id" integer,
  	"at" timestamp(3) with time zone
  );

  CREATE TABLE "coi_declarations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"interest" varchar NOT NULL,
  	"details" varchar NOT NULL,
  	"related_scope" varchar,
  	"status" "enum_coi_declarations_status" DEFAULT 'declared' NOT NULL,
  	"review_note" varchar,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"declared_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "recognition_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"kind" "enum_recognition_requests_kind" NOT NULL,
  	"purpose" varchar NOT NULL,
  	"event_ref" varchar,
  	"status" "enum_recognition_requests_status" DEFAULT 'requested' NOT NULL,
  	"review_note" varchar,
  	"reviewed_by_id" integer,
  	"issued_at" timestamp(3) with time zone,
  	"requested_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "partnership_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"organisation_name" varchar NOT NULL,
  	"kind" "enum_partnership_requests_kind" NOT NULL,
  	"summary" varchar NOT NULL,
  	"value_note" varchar,
  	"requires_council_decision" boolean DEFAULT false,
  	"council_decision_id" integer,
  	"status" "enum_partnership_requests_status" DEFAULT 'proposed' NOT NULL,
  	"review_note" varchar,
  	"reviewed_by_id" integer,
  	"proposed_at" timestamp(3) with time zone NOT NULL,
  	"ended_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "privacy_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"kind" "enum_privacy_requests_kind" NOT NULL,
  	"details" varchar NOT NULL,
  	"status" "enum_privacy_requests_status" DEFAULT 'received' NOT NULL,
  	"response_note" varchar,
  	"due_at" timestamp(3) with time zone NOT NULL,
  	"handled_by_id" integer,
  	"fulfilled_at" timestamp(3) with time zone,
  	"requested_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  `)

  await db.execute(sql`
  ALTER TABLE "funding_requests" ADD CONSTRAINT "funding_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "funding_requests" ADD CONSTRAINT "funding_requests_reviewed_by_id_accounts_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "safeguarding_cases" ADD CONSTRAINT "safeguarding_cases_reporter_id_accounts_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "safeguarding_cases" ADD CONSTRAINT "safeguarding_cases_assigned_to_id_accounts_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "safeguarding_cases_updates" ADD CONSTRAINT "safeguarding_cases_updates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."safeguarding_cases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "safeguarding_cases_updates" ADD CONSTRAINT "safeguarding_cases_updates_by_id_accounts_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coi_declarations" ADD CONSTRAINT "coi_declarations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coi_declarations" ADD CONSTRAINT "coi_declarations_reviewed_by_id_accounts_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recognition_requests" ADD CONSTRAINT "recognition_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recognition_requests" ADD CONSTRAINT "recognition_requests_reviewed_by_id_accounts_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partnership_requests" ADD CONSTRAINT "partnership_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partnership_requests" ADD CONSTRAINT "partnership_requests_council_decision_id_decision_proposals_id_fk" FOREIGN KEY ("council_decision_id") REFERENCES "public"."decision_proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partnership_requests" ADD CONSTRAINT "partnership_requests_reviewed_by_id_accounts_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_handled_by_id_accounts_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  `)

  await db.execute(sql`
  CREATE INDEX "funding_requests_account_idx" ON "funding_requests" USING btree ("account_id");
  CREATE INDEX "funding_requests_status_idx" ON "funding_requests" USING btree ("status");
  CREATE INDEX "safeguarding_cases_reporter_idx" ON "safeguarding_cases" USING btree ("reporter_id");
  CREATE INDEX "safeguarding_cases_status_idx" ON "safeguarding_cases" USING btree ("status");
  CREATE INDEX "safeguarding_cases_updates_order_idx" ON "safeguarding_cases_updates" USING btree ("_order");
  CREATE INDEX "safeguarding_cases_updates_parent_idx" ON "safeguarding_cases_updates" USING btree ("_parent_id");
  CREATE INDEX "coi_declarations_account_idx" ON "coi_declarations" USING btree ("account_id");
  CREATE INDEX "coi_declarations_status_idx" ON "coi_declarations" USING btree ("status");
  CREATE INDEX "recognition_requests_account_idx" ON "recognition_requests" USING btree ("account_id");
  CREATE INDEX "recognition_requests_status_idx" ON "recognition_requests" USING btree ("status");
  CREATE INDEX "partnership_requests_account_idx" ON "partnership_requests" USING btree ("account_id");
  CREATE INDEX "partnership_requests_status_idx" ON "partnership_requests" USING btree ("status");
  CREATE INDEX "partnership_requests_council_decision_idx" ON "partnership_requests" USING btree ("council_decision_id");
  CREATE INDEX "privacy_requests_account_idx" ON "privacy_requests" USING btree ("account_id");
  CREATE INDEX "privacy_requests_status_idx" ON "privacy_requests" USING btree ("status");
  `)

  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "funding_requests_id" integer,
    ADD COLUMN IF NOT EXISTS "safeguarding_cases_id" integer,
    ADD COLUMN IF NOT EXISTS "coi_declarations_id" integer,
    ADD COLUMN IF NOT EXISTS "recognition_requests_id" integer,
    ADD COLUMN IF NOT EXISTS "partnership_requests_id" integer,
    ADD COLUMN IF NOT EXISTS "privacy_requests_id" integer;
  `)

  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_funding_requests_fk" FOREIGN KEY ("funding_requests_id") REFERENCES "public"."funding_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_safeguarding_cases_fk" FOREIGN KEY ("safeguarding_cases_id") REFERENCES "public"."safeguarding_cases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coi_declarations_fk" FOREIGN KEY ("coi_declarations_id") REFERENCES "public"."coi_declarations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_recognition_requests_fk" FOREIGN KEY ("recognition_requests_id") REFERENCES "public"."recognition_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partnership_requests_fk" FOREIGN KEY ("partnership_requests_id") REFERENCES "public"."partnership_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_privacy_requests_fk" FOREIGN KEY ("privacy_requests_id") REFERENCES "public"."privacy_requests"("id") ON DELETE cascade ON UPDATE no action;
  `)

  await db.execute(sql`
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_funding_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("funding_requests_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_safeguarding_cases_id_idx" ON "payload_locked_documents_rels" USING btree ("safeguarding_cases_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_coi_declarations_id_idx" ON "payload_locked_documents_rels" USING btree ("coi_declarations_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_recognition_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("recognition_requests_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_partnership_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("partnership_requests_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_privacy_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("privacy_requests_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    DROP COLUMN IF EXISTS "funding_requests_id",
    DROP COLUMN IF EXISTS "safeguarding_cases_id",
    DROP COLUMN IF EXISTS "coi_declarations_id",
    DROP COLUMN IF EXISTS "recognition_requests_id",
    DROP COLUMN IF EXISTS "partnership_requests_id",
    DROP COLUMN IF EXISTS "privacy_requests_id";

  DROP TABLE "funding_requests" CASCADE;
  DROP TABLE "safeguarding_cases_updates" CASCADE;
  DROP TABLE "safeguarding_cases" CASCADE;
  DROP TABLE "coi_declarations" CASCADE;
  DROP TABLE "recognition_requests" CASCADE;
  DROP TABLE "partnership_requests" CASCADE;
  DROP TABLE "privacy_requests" CASCADE;

  DROP TYPE "public"."enum_funding_requests_category";
  DROP TYPE "public"."enum_funding_requests_status";
  DROP TYPE "public"."enum_safeguarding_cases_kind";
  DROP TYPE "public"."enum_safeguarding_cases_severity";
  DROP TYPE "public"."enum_safeguarding_cases_status";
  DROP TYPE "public"."enum_coi_declarations_status";
  DROP TYPE "public"."enum_recognition_requests_kind";
  DROP TYPE "public"."enum_recognition_requests_status";
  DROP TYPE "public"."enum_partnership_requests_kind";
  DROP TYPE "public"."enum_partnership_requests_status";
  DROP TYPE "public"."enum_privacy_requests_kind";
  DROP TYPE "public"."enum_privacy_requests_status";
  `)
}
