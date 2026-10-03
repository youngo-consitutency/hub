import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Migration-source uniqueness for the appointments backfill. The
// active-only (account, role, scope) index cannot protect a migration
// record: a revoked or expired appointment is excluded from it, so a stale
// or overlapping run could insert a second active row for the same source.
// This expression index makes the immutable source link
// (`appointed_via->>'assignmentId'`) unique across ALL statuses — the
// database, not the plan, decides whether a source row has been migrated.
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
