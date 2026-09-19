import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // wg_progress gains the legacy approval-queue statuses.
  await db.execute(sql`ALTER TYPE "public"."enum_wg_progress_status" ADD VALUE 'pending_approval'`)
  await db.execute(sql`ALTER TYPE "public"."enum_wg_progress_status" ADD VALUE 'rejected'`)
  // At most one open (submitted) appeal per account — enforced at the DB so
  // concurrent submissions can't both pass the application-level check.
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_appeals_open
      ON membership_appeals (account_id) WHERE status = 'submitted'
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS uq_membership_appeals_open`)
  // Postgres cannot remove enum values; statuses stay available on downgrade.
}
