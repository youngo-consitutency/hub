import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Migration-source uniqueness for the backfill: the active-only index can't
// cover revoked/expired rows, so the immutable source link
// (`appointed_via->>'assignmentId'`) is unique across ALL statuses.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE UNIQUE INDEX "appointments_migration_source_unique"
    ON "appointments" (("appointed_via"->>'assignmentId'))
    WHERE "appointed_via"->>'source' = 'assignments_migration';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "appointments_migration_source_unique";
  `)
}
