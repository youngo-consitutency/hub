import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Register the decision collections in Payload's system rels table — every
// collection gets a column here so document-locking can reference it.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "decision_proposals_id" integer,
    ADD COLUMN IF NOT EXISTS "decision_flags_id" integer,
    ADD COLUMN IF NOT EXISTS "decision_comments_id" integer,
    ADD COLUMN IF NOT EXISTS "decision_ballots_id" integer,
    ADD COLUMN IF NOT EXISTS "decision_vetoes_id" integer,
    ADD COLUMN IF NOT EXISTS "decision_events_id" integer;
  `)
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_decision_proposals_fk" FOREIGN KEY ("decision_proposals_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_decision_flags_fk" FOREIGN KEY ("decision_flags_id") REFERENCES "public"."decision_flags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_decision_comments_fk" FOREIGN KEY ("decision_comments_id") REFERENCES "public"."decision_comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_decision_ballots_fk" FOREIGN KEY ("decision_ballots_id") REFERENCES "public"."decision_ballots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_decision_vetoes_fk" FOREIGN KEY ("decision_vetoes_id") REFERENCES "public"."decision_vetoes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_decision_events_fk" FOREIGN KEY ("decision_events_id") REFERENCES "public"."decision_events"("id") ON DELETE cascade ON UPDATE no action;
  `)
  await db.execute(sql`
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_decision_proposals_id_idx" ON "payload_locked_documents_rels" USING btree ("decision_proposals_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_decision_flags_id_idx" ON "payload_locked_documents_rels" USING btree ("decision_flags_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_decision_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("decision_comments_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_decision_ballots_id_idx" ON "payload_locked_documents_rels" USING btree ("decision_ballots_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_decision_vetoes_id_idx" ON "payload_locked_documents_rels" USING btree ("decision_vetoes_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_decision_events_id_idx" ON "payload_locked_documents_rels" USING btree ("decision_events_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    DROP COLUMN IF EXISTS "decision_proposals_id",
    DROP COLUMN IF EXISTS "decision_flags_id",
    DROP COLUMN IF EXISTS "decision_comments_id",
    DROP COLUMN IF EXISTS "decision_ballots_id",
    DROP COLUMN IF EXISTS "decision_vetoes_id",
    DROP COLUMN IF EXISTS "decision_events_id";
  `)
}
