import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// S10 elections + S24 selections. Secret ballots are keyed by voter-token
// HMAC and deliberately carry no account column (server-trust secrecy).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_elections_kind" AS ENUM('focal_point', 'other');
  CREATE TYPE "public"."enum_elections_status" AS ENUM('announced', 'nominations', 'voting', 'tallying', 'completed', 'restart_required', 'cancelled');
  CREATE TYPE "public"."enum_election_candidates_status" AS ENUM('pending', 'screened_in', 'screened_out', 'withdrawn');
  CREATE TYPE "public"."enum_election_voters_kind" AS ENUM('individual', 'organisation');
  CREATE TYPE "public"."enum_election_ballots_kind" AS ENUM('individual', 'organisation');
  CREATE TYPE "public"."enum_selections_kind" AS ENUM('standard', 'wg_nomination');
  CREATE TYPE "public"."enum_selections_status" AS ENUM('committee_forming', 'open', 'closed', 'evaluating', 'decided', 'announced', 'cancelled');
  CREATE TYPE "public"."enum_selections_method" AS ENUM('colour', 'numerical');
  CREATE TYPE "public"."enum_selection_applications_status" AS ENUM('submitted', 'selected', 'not_selected', 'withdrawn');
  CREATE TYPE "public"."enum_selection_evaluations_grade" AS ENUM('black', 'red', 'orange', 'yellow', 'green');

  CREATE TABLE "elections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" "enum_elections_kind" DEFAULT 'focal_point' NOT NULL,
  	"status" "enum_elections_status" DEFAULT 'announced' NOT NULL,
  	"description" varchar,
  	"nominations_open_at" timestamp(3) with time zone,
  	"nominations_close_at" timestamp(3) with time zone,
  	"voting_opens_at" timestamp(3) with time zone,
  	"voting_close_at" timestamp(3) with time zone,
  	"quorum_individuals" numeric DEFAULT 100,
  	"quorum_organisations" numeric DEFAULT 25,
  	"eligible_individual_count" numeric,
  	"eligible_org_count" numeric,
  	"result" jsonb,
  	"external_ref" varchar,
  	"facilitation_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "elections_races" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"label" varchar NOT NULL
  );

  CREATE TABLE "election_candidates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"election_id" integer NOT NULL,
  	"race" varchar NOT NULL,
  	"account_id" integer NOT NULL,
  	"statement" varchar NOT NULL,
  	"video_url" varchar,
  	"status" "enum_election_candidates_status" DEFAULT 'pending' NOT NULL,
  	"screening_note" varchar,
  	"nominated_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "election_voters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"election_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"kind" "enum_election_voters_kind" NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"issued_at" timestamp(3) with time zone NOT NULL,
  	"voted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "election_ballots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"election_id" integer NOT NULL,
  	"race" varchar NOT NULL,
  	"voter_token_hash" varchar NOT NULL,
  	"kind" "enum_election_ballots_kind" NOT NULL,
  	"ranks" jsonb NOT NULL,
  	"cast_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "selections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"opportunity_note" varchar NOT NULL,
  	"kind" "enum_selections_kind" DEFAULT 'standard' NOT NULL,
  	"body_ref" varchar,
  	"status" "enum_selections_status" DEFAULT 'committee_forming' NOT NULL,
  	"method" "enum_selections_method" DEFAULT 'colour' NOT NULL,
  	"deadline_at" timestamp(3) with time zone,
  	"spots_available" numeric DEFAULT 1,
  	"balance_note" varchar,
  	"selection_summary" varchar,
  	"created_by_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "selections_criteria" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"weight_pct" numeric NOT NULL
  );

  CREATE TABLE "selection_committee" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"selection_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"joined_at" timestamp(3) with time zone NOT NULL,
  	"recused_applicant_ids" jsonb,
  	"coi_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "selection_applications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"selection_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"answers" jsonb NOT NULL,
  	"self_finance" boolean,
  	"gender" varchar,
  	"region" varchar,
  	"status" "enum_selection_applications_status" DEFAULT 'submitted' NOT NULL,
  	"submitted_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "selection_evaluations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"selection_id" integer NOT NULL,
  	"application_id" integer NOT NULL,
  	"evaluator_id" integer NOT NULL,
  	"grade" "enum_selection_evaluations_grade",
  	"scores" jsonb,
  	"comment" varchar,
  	"evaluated_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  `)

  await db.execute(sql`
  ALTER TABLE "elections_races" ADD CONSTRAINT "elections_races_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."elections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "election_voters" ADD CONSTRAINT "election_voters_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "election_voters" ADD CONSTRAINT "election_voters_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "election_ballots" ADD CONSTRAINT "election_ballots_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selections" ADD CONSTRAINT "selections_created_by_id_accounts_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selections_criteria" ADD CONSTRAINT "selections_criteria_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."selections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "selection_committee" ADD CONSTRAINT "selection_committee_selection_id_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."selections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_committee" ADD CONSTRAINT "selection_committee_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_applications" ADD CONSTRAINT "selection_applications_selection_id_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."selections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_applications" ADD CONSTRAINT "selection_applications_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_evaluations" ADD CONSTRAINT "selection_evaluations_selection_id_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."selections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_evaluations" ADD CONSTRAINT "selection_evaluations_application_id_selection_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."selection_applications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_evaluations" ADD CONSTRAINT "selection_evaluations_evaluator_id_accounts_id_fk" FOREIGN KEY ("evaluator_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  `)

  await db.execute(sql`
  CREATE INDEX "elections_kind_idx" ON "elections" USING btree ("kind");
  CREATE INDEX "elections_status_idx" ON "elections" USING btree ("status");
  CREATE INDEX "elections_races_order_idx" ON "elections_races" USING btree ("_order");
  CREATE INDEX "elections_races_parent_idx" ON "elections_races" USING btree ("_parent_id");
  CREATE INDEX "election_candidates_election_idx" ON "election_candidates" USING btree ("election_id");
  CREATE INDEX "election_candidates_race_idx" ON "election_candidates" USING btree ("race");
  CREATE INDEX "election_candidates_account_idx" ON "election_candidates" USING btree ("account_id");
  CREATE INDEX "election_candidates_status_idx" ON "election_candidates" USING btree ("status");
  CREATE INDEX "election_voters_election_idx" ON "election_voters" USING btree ("election_id");
  CREATE INDEX "election_voters_account_idx" ON "election_voters" USING btree ("account_id");
  CREATE INDEX "election_voters_token_hash_idx" ON "election_voters" USING btree ("token_hash");
  CREATE UNIQUE INDEX "election_voters_election_account_idx" ON "election_voters" USING btree ("election_id", "account_id");
  CREATE INDEX "election_ballots_election_idx" ON "election_ballots" USING btree ("election_id");
  CREATE INDEX "election_ballots_race_idx" ON "election_ballots" USING btree ("race");
  CREATE INDEX "election_ballots_voter_token_hash_idx" ON "election_ballots" USING btree ("voter_token_hash");
  CREATE UNIQUE INDEX "election_ballots_election_race_token_idx" ON "election_ballots" USING btree ("election_id", "race", "voter_token_hash");
  CREATE INDEX "selections_status_idx" ON "selections" USING btree ("status");
  CREATE INDEX "selections_created_by_idx" ON "selections" USING btree ("created_by_id");
  CREATE INDEX "selections_criteria_order_idx" ON "selections_criteria" USING btree ("_order");
  CREATE INDEX "selections_criteria_parent_idx" ON "selections_criteria" USING btree ("_parent_id");
  CREATE INDEX "selection_committee_selection_idx" ON "selection_committee" USING btree ("selection_id");
  CREATE INDEX "selection_committee_account_idx" ON "selection_committee" USING btree ("account_id");
  CREATE UNIQUE INDEX "selection_committee_selection_account_idx" ON "selection_committee" USING btree ("selection_id", "account_id");
  CREATE INDEX "selection_applications_selection_idx" ON "selection_applications" USING btree ("selection_id");
  CREATE INDEX "selection_applications_account_idx" ON "selection_applications" USING btree ("account_id");
  CREATE INDEX "selection_applications_status_idx" ON "selection_applications" USING btree ("status");
  CREATE UNIQUE INDEX "selection_applications_selection_account_idx" ON "selection_applications" USING btree ("selection_id", "account_id");
  CREATE INDEX "selection_evaluations_selection_idx" ON "selection_evaluations" USING btree ("selection_id");
  CREATE INDEX "selection_evaluations_application_idx" ON "selection_evaluations" USING btree ("application_id");
  CREATE INDEX "selection_evaluations_evaluator_idx" ON "selection_evaluations" USING btree ("evaluator_id");
  `)

  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "elections_id" integer,
    ADD COLUMN IF NOT EXISTS "election_candidates_id" integer,
    ADD COLUMN IF NOT EXISTS "election_voters_id" integer,
    ADD COLUMN IF NOT EXISTS "election_ballots_id" integer,
    ADD COLUMN IF NOT EXISTS "selections_id" integer,
    ADD COLUMN IF NOT EXISTS "selection_committee_id" integer,
    ADD COLUMN IF NOT EXISTS "selection_applications_id" integer,
    ADD COLUMN IF NOT EXISTS "selection_evaluations_id" integer;
  `)

  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_elections_fk" FOREIGN KEY ("elections_id") REFERENCES "public"."elections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_election_candidates_fk" FOREIGN KEY ("election_candidates_id") REFERENCES "public"."election_candidates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_election_voters_fk" FOREIGN KEY ("election_voters_id") REFERENCES "public"."election_voters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_election_ballots_fk" FOREIGN KEY ("election_ballots_id") REFERENCES "public"."election_ballots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_selections_fk" FOREIGN KEY ("selections_id") REFERENCES "public"."selections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_selection_committee_fk" FOREIGN KEY ("selection_committee_id") REFERENCES "public"."selection_committee"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_selection_applications_fk" FOREIGN KEY ("selection_applications_id") REFERENCES "public"."selection_applications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_selection_evaluations_fk" FOREIGN KEY ("selection_evaluations_id") REFERENCES "public"."selection_evaluations"("id") ON DELETE cascade ON UPDATE no action;
  `)

  await db.execute(sql`
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_elections_id_idx" ON "payload_locked_documents_rels" USING btree ("elections_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_election_candidates_id_idx" ON "payload_locked_documents_rels" USING btree ("election_candidates_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_election_voters_id_idx" ON "payload_locked_documents_rels" USING btree ("election_voters_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_election_ballots_id_idx" ON "payload_locked_documents_rels" USING btree ("election_ballots_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_selections_id_idx" ON "payload_locked_documents_rels" USING btree ("selections_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_selection_committee_id_idx" ON "payload_locked_documents_rels" USING btree ("selection_committee_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_selection_applications_id_idx" ON "payload_locked_documents_rels" USING btree ("selection_applications_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_selection_evaluations_id_idx" ON "payload_locked_documents_rels" USING btree ("selection_evaluations_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    DROP COLUMN IF EXISTS "elections_id",
    DROP COLUMN IF EXISTS "election_candidates_id",
    DROP COLUMN IF EXISTS "election_voters_id",
    DROP COLUMN IF EXISTS "election_ballots_id",
    DROP COLUMN IF EXISTS "selections_id",
    DROP COLUMN IF EXISTS "selection_committee_id",
    DROP COLUMN IF EXISTS "selection_applications_id",
    DROP COLUMN IF EXISTS "selection_evaluations_id";

  DROP TABLE "elections_races" CASCADE;
  DROP TABLE "election_candidates" CASCADE;
  DROP TABLE "election_voters" CASCADE;
  DROP TABLE "election_ballots" CASCADE;
  DROP TABLE "elections" CASCADE;
  DROP TABLE "selections_criteria" CASCADE;
  DROP TABLE "selection_committee" CASCADE;
  DROP TABLE "selection_applications" CASCADE;
  DROP TABLE "selection_evaluations" CASCADE;
  DROP TABLE "selections" CASCADE;

  DROP TYPE "public"."enum_elections_kind";
  DROP TYPE "public"."enum_elections_status";
  DROP TYPE "public"."enum_election_candidates_status";
  DROP TYPE "public"."enum_election_voters_kind";
  DROP TYPE "public"."enum_election_ballots_kind";
  DROP TYPE "public"."enum_selections_kind";
  DROP TYPE "public"."enum_selections_status";
  DROP TYPE "public"."enum_selections_method";
  DROP TYPE "public"."enum_selection_applications_status";
  DROP TYPE "public"."enum_selection_evaluations_grade";
  `)
}
