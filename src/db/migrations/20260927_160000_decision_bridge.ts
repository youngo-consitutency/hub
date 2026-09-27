import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Unify the legacy platform_decisions workflow with the S09 decision engine.
// decision_proposals gains the fields the operational UI needs (versioning,
// publication, recorded tallies, revision history); existing platform_*
// records are imported and platform_decisions keeps a uuid projection so
// platform_tasks/platform_enquiries foreign keys keep resolving.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "decision_proposals"
    ADD COLUMN "policy_version" varchar,
    ADD COLUMN "snap_hours" numeric,
    ADD COLUMN "version" numeric DEFAULT 1 NOT NULL,
    ADD COLUMN "legacy_ref" varchar,
    ADD COLUMN "outcome_evidence" varchar,
    ADD COLUMN "votes_for" numeric,
    ADD COLUMN "votes_against" numeric,
    ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;
  CREATE UNIQUE INDEX "decision_proposals_legacy_ref_idx" ON "decision_proposals" USING btree ("legacy_ref");

  CREATE TABLE "decision_proposals_revisions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"version" numeric NOT NULL,
  	"title" varchar NOT NULL,
  	"proposal" varchar NOT NULL,
  	"created_at" timestamp(3) with time zone
  );
  ALTER TABLE "decision_proposals_revisions" ADD CONSTRAINT "decision_proposals_revisions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "decision_proposals_revisions_order_idx" ON "decision_proposals_revisions" USING btree ("_order");
  CREATE INDEX "decision_proposals_revisions_parent_idx" ON "decision_proposals_revisions" USING btree ("_parent_id");

  ALTER TABLE "platform_decisions" ADD COLUMN "s09_proposal_id" integer REFERENCES "public"."decision_proposals"("id") ON DELETE set null;
  CREATE UNIQUE INDEX "platform_decisions_s09_proposal_id_idx" ON "platform_decisions" USING btree ("s09_proposal_id");
  `)

  // Import every legacy decision into the S09 store, keeping the uuid in
  // legacy_ref so historical links and the projection join keep working.
  await db.execute(sql`
  INSERT INTO "decision_proposals" (
  	"title", "context", "proposal_text", "decision_type",
  	"body", "body_ref", "snap_justification", "snap_hours",
  	"policy_version", "status", "proposed_by_id",
  	"eligible_voter_count", "votes_for", "votes_against",
  	"adopted_via", "result_summary", "outcome_evidence",
  	"is_public", "decided_at", "version", "legacy_ref",
  	"created_at", "updated_at",
  	"presented_at", "consultation_ends_at", "revision_ends_at",
  	"decision_ends_at", "voting_ends_at"
  )
  SELECT
  	pd.title, pd.proposal, pd.proposal,
  	CASE pd.process WHEN 'snap' THEN 'snap' ELSE 'standard' END::"enum_decision_proposals_decision_type",
  	CASE b.kind
  	  WHEN 'council' THEN 'council'
  	  WHEN 'coordination' THEN 'operational_team'
  	  WHEN 'operational_team' THEN 'operational_team'
  	  ELSE 'working_group'
  	END::"enum_decision_proposals_body",
  	CASE WHEN b.kind = 'council' THEN NULL ELSE pd.body_id END,
  	pd.urgency_reason, pd.snap_hours, pd.policy_version,
  	CASE pd.stage
  	  WHEN 'not_adopted' THEN 'rejected'
  	  ELSE pd.stage
  	END::"enum_decision_proposals_status",
  	pd.author_id,
  	pd.electorate_size, pd.votes_for, pd.votes_against,
  	(CASE pd.stage
  	  WHEN 'adopted' THEN CASE WHEN pd.votes_for IS NOT NULL THEN 'vote' ELSE 'consensus' END
  	  ELSE NULL
  	END)::"enum_decision_proposals_adopted_via",
  	pd.outcome, pd.outcome_evidence, pd.is_public,
  	CASE WHEN pd.stage IN ('adopted','not_adopted','withdrawn') THEN pd.updated_at ELSE NULL END,
  	pd.version, pd.id::text,
  	pd.updated_at, pd.updated_at,
  	CASE WHEN pd.stage <> 'draft' THEN pd.updated_at ELSE NULL END,
  	CASE WHEN pd.stage = 'consultation' THEN pd.deadline_at ELSE NULL END,
  	CASE WHEN pd.stage = 'revision' THEN pd.deadline_at ELSE NULL END,
  	CASE WHEN pd.stage = 'decision' THEN pd.deadline_at ELSE NULL END,
  	CASE WHEN pd.stage = 'voting' THEN pd.deadline_at ELSE NULL END
  FROM "platform_decisions" pd
  JOIN "platform_bodies" b ON b.id = pd.body_id;

  UPDATE "platform_decisions" pd
  SET "s09_proposal_id" = dp.id
  FROM "decision_proposals" dp
  WHERE dp.legacy_ref = pd.id::text;

  INSERT INTO "decision_proposals_rels" ("order", "parent_id", "path", "accounts_id")
  SELECT 0, dp.id, 'contactPersons', dp.proposed_by_id
  FROM "decision_proposals" dp
  WHERE dp.legacy_ref IS NOT NULL;
  `)

  // Import contributions: comments → decision_comments, flags →
  // decision_flags (resolved flags become withdrawn, keeping the note).
  await db.execute(sql`
  INSERT INTO "decision_comments" ("proposal_id", "account_id", "body", "created_at", "updated_at")
  SELECT pd.s09_proposal_id, c.author_id, c.text, c.created_at, c.created_at
  FROM "platform_contributions" c
  JOIN "platform_decisions" pd ON pd.id = c.decision_id
  WHERE c.kind = 'comment' AND pd.s09_proposal_id IS NOT NULL;

  INSERT INTO "decision_flags" (
  	"proposal_id", "kind", "reason", "alternative", "raised_by_id",
  	"status", "response_note", "responded_by_id", "responded_at",
  	"raised_at", "created_at", "updated_at"
  )
  SELECT
  	pd.s09_proposal_id, c.kind::"enum_decision_flags_kind",
  	CASE WHEN c.grounds <> '' THEN c.text || E'\n\n' || c.grounds ELSE c.text END,
  	NULLIF(c.alternative, ''),
  	c.author_id,
  	(CASE WHEN c.resolution IS NOT NULL THEN 'withdrawn' ELSE 'open' END)::"enum_decision_flags_status",
  	c.resolution, c.resolved_by, c.resolved_at,
  	c.created_at, c.created_at, c.created_at
  FROM "platform_contributions" c
  JOIN "platform_decisions" pd ON pd.id = c.decision_id
  WHERE c.kind IN ('red', 'grey') AND pd.s09_proposal_id IS NOT NULL;

  INSERT INTO "decision_proposals_revisions" ("_order", "_parent_id", "id", "version", "title", "proposal", "created_at")
  SELECT 0, pd.s09_proposal_id, gen_random_uuid()::text, r.version, r.title, r.proposal, r.created_at
  FROM "platform_decision_revisions" r
  JOIN "platform_decisions" pd ON pd.id = r.decision_id
  WHERE pd.s09_proposal_id IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DELETE FROM "decision_proposals_revisions" r
  USING "decision_proposals" dp
  WHERE r."_parent_id" = dp.id AND dp.legacy_ref IS NOT NULL;
  DELETE FROM "decision_flags" f
  USING "decision_proposals" dp
  WHERE f.proposal_id = dp.id AND dp.legacy_ref IS NOT NULL;
  DELETE FROM "decision_comments" c
  USING "decision_proposals" dp
  WHERE c.proposal_id = dp.id AND dp.legacy_ref IS NOT NULL;
  DELETE FROM "decision_proposals_rels" rel
  USING "decision_proposals" dp
  WHERE rel.parent_id = dp.id AND dp.legacy_ref IS NOT NULL;
  DELETE FROM "decision_proposals" WHERE legacy_ref IS NOT NULL;

  ALTER TABLE "platform_decisions" DROP COLUMN "s09_proposal_id";
  DROP TABLE "decision_proposals_revisions";
  ALTER TABLE "decision_proposals"
    DROP COLUMN "policy_version",
    DROP COLUMN "snap_hours",
    DROP COLUMN "version",
    DROP COLUMN "legacy_ref",
    DROP COLUMN "outcome_evidence",
    DROP COLUMN "votes_for",
    DROP COLUMN "votes_against",
    DROP COLUMN "is_public";
  `)
}
