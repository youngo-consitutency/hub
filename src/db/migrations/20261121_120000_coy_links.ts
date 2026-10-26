import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Organiser contact and outbound links carried by the 2026 COY tracker.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "content_coys"
    ADD COLUMN IF NOT EXISTS "organizer_email" varchar,
    ADD COLUMN IF NOT EXISTS "instagram_url" varchar,
    ADD COLUMN IF NOT EXISTS "statement_url" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "content_coys"
    DROP COLUMN IF EXISTS "organizer_email",
    DROP COLUMN IF EXISTS "instagram_url",
    DROP COLUMN IF EXISTS "statement_url";
  `)
}
