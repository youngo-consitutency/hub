import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// S09 decision engine tables. All writes flow through
// src/endpoints/decisions.ts — this migration only creates storage.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_decision_proposals_decision_type" AS ENUM('standard', 'snap', 'og_standard', 'og_snap', 'press_release');
  CREATE TYPE "public"."enum_decision_proposals_body" AS ENUM('council', 'working_group', 'operational_team', 'gct', 'constituency');
  CREATE TYPE "public"."enum_decision_proposals_status" AS ENUM('draft', 'consultation', 'revision', 'decision', 'voting', 'adopted', 'vetoed', 'withdrawn', 'failed_quorum', 'rejected');
  CREATE TYPE "public"."enum_decision_proposals_adopted_via" AS ENUM('consensus', 'consensus_with_reservations', 'vote', 'meeting');
  CREATE TYPE "public"."enum_decision_flags_kind" AS ENUM('red', 'grey');
  CREATE TYPE "public"."enum_decision_flags_rationale_category" AS ENUM('principles_violation', 'coc_violation', 'science_contradiction', 'past_decision_contradiction', 'process_noncompliance', 'mission_misalignment', 'inadequate_consultation', 'grey_flag_unsatisfactory');
  CREATE TYPE "public"."enum_decision_flags_status" AS ENUM('open', 'addressed', 'withdrawn', 'nullified');
  CREATE TYPE "public"."enum_decision_vetoes_requester_kind" AS ENUM('org', 'org_global_south', 'wg_or_ot');
  CREATE TYPE "public"."enum_decision_vetoes_status" AS ENUM('pending', 'confirmed', 'rejected');

  CREATE TABLE "decision_proposals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"context" varchar NOT NULL,
  	"proposal_text" varchar NOT NULL,
  	"decision_type" "enum_decision_proposals_decision_type" DEFAULT 'standard' NOT NULL,
  	"body" "enum_decision_proposals_body" NOT NULL,
  	"body_ref" varchar,
  	"snap_justification" varchar,
  	"snap_deadline" timestamp(3) with time zone,
  	"status" "enum_decision_proposals_status" DEFAULT 'draft' NOT NULL,
  	"proposed_by_id" integer NOT NULL,
  	"presented_at" timestamp(3) with time zone,
  	"consultation_ends_at" timestamp(3) with time zone,
  	"revision_ends_at" timestamp(3) with time zone,
  	"decision_ends_at" timestamp(3) with time zone,
  	"voting_ends_at" timestamp(3) with time zone,
  	"eligible_voter_count" numeric,
  	"adopted_via" "enum_decision_proposals_adopted_via",
  	"decided_at" timestamp(3) with time zone,
  	"result_summary" varchar,
  	"tracker_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "decision_proposals_ballot_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"option" varchar NOT NULL
  );

  CREATE TABLE "decision_proposals_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"accounts_id" integer
  );

  CREATE TABLE "decision_flags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"proposal_id" integer NOT NULL,
  	"kind" "enum_decision_flags_kind" NOT NULL,
  	"rationale_category" "enum_decision_flags_rationale_category",
  	"reason" varchar NOT NULL,
  	"alternative" varchar,
  	"raised_by_id" integer NOT NULL,
  	"status" "enum_decision_flags_status" DEFAULT 'open' NOT NULL,
  	"response_note" varchar,
  	"responded_by_id" integer,
  	"responded_at" timestamp(3) with time zone,
  	"raised_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "decision_comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"proposal_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"body" varchar NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "decision_ballots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"proposal_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"choice" varchar NOT NULL,
  	"cast_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "decision_vetoes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"proposal_id" integer NOT NULL,
  	"requester_kind" "enum_decision_vetoes_requester_kind" NOT NULL,
  	"group_key" varchar NOT NULL,
  	"reasoning" varchar NOT NULL,
  	"requested_by_id" integer NOT NULL,
  	"status" "enum_decision_vetoes_status" DEFAULT 'pending' NOT NULL,
  	"created_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "decision_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"proposal_id" integer NOT NULL,
  	"type" varchar NOT NULL,
  	"actor_id" integer,
  	"detail" jsonb,
  	"created_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  `)

  await db.execute(sql`
  ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_proposed_by_id_accounts_id_fk" FOREIGN KEY ("proposed_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_proposals_ballot_options" ADD CONSTRAINT "decision_proposals_ballot_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "decision_proposals_rels" ADD CONSTRAINT "decision_proposals_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "decision_proposals_rels" ADD CONSTRAINT "decision_proposals_rels_accounts_fk" FOREIGN KEY ("accounts_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "decision_flags" ADD CONSTRAINT "decision_flags_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_flags" ADD CONSTRAINT "decision_flags_raised_by_id_accounts_id_fk" FOREIGN KEY ("raised_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_flags" ADD CONSTRAINT "decision_flags_responded_by_id_accounts_id_fk" FOREIGN KEY ("responded_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_comments" ADD CONSTRAINT "decision_comments_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_comments" ADD CONSTRAINT "decision_comments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_ballots" ADD CONSTRAINT "decision_ballots_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_ballots" ADD CONSTRAINT "decision_ballots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_vetoes" ADD CONSTRAINT "decision_vetoes_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_vetoes" ADD CONSTRAINT "decision_vetoes_requested_by_id_accounts_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_events" ADD CONSTRAINT "decision_events_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "decision_events" ADD CONSTRAINT "decision_events_actor_id_accounts_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  `)

  await db.execute(sql`
  CREATE INDEX "decision_proposals_body_idx" ON "decision_proposals" USING btree ("body");
  CREATE INDEX "decision_proposals_body_ref_idx" ON "decision_proposals" USING btree ("body_ref");
  CREATE INDEX "decision_proposals_status_idx" ON "decision_proposals" USING btree ("status");
  CREATE INDEX "decision_proposals_proposed_by_idx" ON "decision_proposals" USING btree ("proposed_by_id");
  CREATE INDEX "decision_proposals_ballot_options_order_idx" ON "decision_proposals_ballot_options" USING btree ("_order");
  CREATE INDEX "decision_proposals_ballot_options_parent_idx" ON "decision_proposals_ballot_options" USING btree ("_parent_id");
  CREATE INDEX "decision_proposals_rels_order_idx" ON "decision_proposals_rels" USING btree ("order");
  CREATE INDEX "decision_proposals_rels_parent_idx" ON "decision_proposals_rels" USING btree ("parent_id");
  CREATE INDEX "decision_proposals_rels_path_idx" ON "decision_proposals_rels" USING btree ("path");
  CREATE INDEX "decision_proposals_rels_accounts_idx" ON "decision_proposals_rels" USING btree ("accounts_id");
  CREATE INDEX "decision_flags_proposal_idx" ON "decision_flags" USING btree ("proposal_id");
  CREATE INDEX "decision_flags_kind_idx" ON "decision_flags" USING btree ("kind");
  CREATE INDEX "decision_flags_status_idx" ON "decision_flags" USING btree ("status");
  CREATE INDEX "decision_flags_raised_by_idx" ON "decision_flags" USING btree ("raised_by_id");
  CREATE INDEX "decision_comments_proposal_idx" ON "decision_comments" USING btree ("proposal_id");
  CREATE INDEX "decision_comments_account_idx" ON "decision_comments" USING btree ("account_id");
  CREATE INDEX "decision_ballots_proposal_idx" ON "decision_ballots" USING btree ("proposal_id");
  CREATE INDEX "decision_ballots_account_idx" ON "decision_ballots" USING btree ("account_id");
  CREATE UNIQUE INDEX "decision_ballots_proposal_account_idx" ON "decision_ballots" USING btree ("proposal_id", "account_id");
  CREATE INDEX "decision_vetoes_proposal_idx" ON "decision_vetoes" USING btree ("proposal_id");
  CREATE INDEX "decision_vetoes_status_idx" ON "decision_vetoes" USING btree ("status");
  CREATE INDEX "decision_events_proposal_idx" ON "decision_events" USING btree ("proposal_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE "decision_proposals_ballot_options" CASCADE;
  DROP TABLE "decision_proposals_rels" CASCADE;
  DROP TABLE "decision_flags" CASCADE;
  DROP TABLE "decision_comments" CASCADE;
  DROP TABLE "decision_ballots" CASCADE;
  DROP TABLE "decision_vetoes" CASCADE;
  DROP TABLE "decision_events" CASCADE;
  DROP TABLE "decision_proposals" CASCADE;
  DROP TYPE "public"."enum_decision_proposals_decision_type";
  DROP TYPE "public"."enum_decision_proposals_body";
  DROP TYPE "public"."enum_decision_proposals_status";
  DROP TYPE "public"."enum_decision_proposals_adopted_via";
  DROP TYPE "public"."enum_decision_flags_kind";
  DROP TYPE "public"."enum_decision_flags_rationale_category";
  DROP TYPE "public"."enum_decision_flags_status";
  DROP TYPE "public"."enum_decision_vetoes_requester_kind";
  DROP TYPE "public"."enum_decision_vetoes_status";
  `)
}
