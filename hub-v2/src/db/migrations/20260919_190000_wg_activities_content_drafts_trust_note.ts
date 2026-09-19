import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Reshape wg_activities to the legacy contract (slug-keyed rows with
  // kind/body/starts_at/ends_at/url/task_force_slug/created_by).
  await db.execute(sql`
    ALTER TABLE "wg_activities"
      DROP CONSTRAINT IF EXISTS "wg_activities_wg_id_working_groups_id_fk",
      DROP CONSTRAINT IF EXISTS "wg_activities_posted_by_id_accounts_id_fk",
      DROP COLUMN IF EXISTS "wg_id",
      DROP COLUMN IF EXISTS "note",
      DROP COLUMN IF EXISTS "link_url",
      DROP COLUMN IF EXISTS "posted_by_id",
      DROP COLUMN IF EXISTS "posted_at",
      ADD COLUMN IF NOT EXISTS "wg_slug" varchar NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "body" varchar,
      ADD COLUMN IF NOT EXISTS "starts_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "ends_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "url" varchar,
      ADD COLUMN IF NOT EXISTS "task_force_slug" varchar,
      ADD COLUMN IF NOT EXISTS "created_by_id" integer;
    ALTER TABLE "wg_activities" DROP COLUMN IF EXISTS "kind";
    ALTER TABLE "wg_activities" ADD COLUMN "kind" varchar NOT NULL DEFAULT 'update';
    ALTER TABLE "wg_activities" ADD CONSTRAINT "wg_activities_created_by_id_accounts_id_fk"
      FOREIGN KEY ("created_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX IF NOT EXISTS "wg_activities_wg_slug_idx" ON "wg_activities" USING btree ("wg_slug");
  `)

  // Draft submit/review timestamps the legacy view exposes.
  await db.execute(sql`
    ALTER TABLE "content_drafts"
      ADD COLUMN IF NOT EXISTS "submitted_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp(3) with time zone;
  `)

  // Free-text note stored with an org posting-trust override.
  await db.execute(sql`
    ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "posting_trust_note" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "accounts" DROP COLUMN IF EXISTS "posting_trust_note";
    ALTER TABLE "content_drafts"
      DROP COLUMN IF EXISTS "submitted_at",
      DROP COLUMN IF EXISTS "reviewed_at";
    ALTER TABLE "wg_activities"
      DROP CONSTRAINT IF EXISTS "wg_activities_created_by_id_accounts_id_fk",
      DROP COLUMN IF EXISTS "wg_slug",
      DROP COLUMN IF EXISTS "body",
      DROP COLUMN IF EXISTS "starts_at",
      DROP COLUMN IF EXISTS "ends_at",
      DROP COLUMN IF EXISTS "url",
      DROP COLUMN IF EXISTS "task_force_slug",
      DROP COLUMN IF EXISTS "created_by_id";
  `)
}
