import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Browser context the feedback form already sends, so the team can reproduce
// a report without a follow-up conversation.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "feedback_tickets"
    ADD COLUMN IF NOT EXISTS "user_agent" varchar,
    ADD COLUMN IF NOT EXISTS "viewport" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "feedback_tickets"
    DROP COLUMN IF EXISTS "user_agent",
    DROP COLUMN IF EXISTS "viewport";
  `)
}
