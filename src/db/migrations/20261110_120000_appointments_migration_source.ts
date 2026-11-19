import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// The active-only index misses revoked/expired rows, so make the source link unique across all statuses.
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
