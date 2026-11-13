import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// the hub consultation feature is retired: its contributions table (names, emails, free text)
// is dropped for good, so export anything worth keeping before this runs
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_consultation_contributions_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_consultation_contributions_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "consultation_contributions_id";
    DROP TABLE IF EXISTS "consultation_contributions" CASCADE;
  `)
}

// structure only: the dropped rows are not recoverable
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "consultation_contributions" (
      "id" serial PRIMARY KEY NOT NULL,
      "kind" varchar NOT NULL,
      "name" varchar,
      "email" varchar,
      "organization" varchar,
      "body" varchar,
      "meta" jsonb,
      "consent_given" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "consultation_contributions_kind_idx"
      ON "consultation_contributions" USING btree ("kind");
    CREATE INDEX IF NOT EXISTS "consultation_contributions_updated_at_idx"
      ON "consultation_contributions" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "consultation_contributions_created_at_idx"
      ON "consultation_contributions" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "consultation_contributions_id" integer;
  `)
}
