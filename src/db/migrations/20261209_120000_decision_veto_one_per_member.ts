import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// One veto request per member per proposal. The endpoint checks first, but two concurrent requests
// could both pass that check; the index is the real guard.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // fail with a clear message, rather than half-applying, if old data already breaks the rule
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM decision_vetoes
        GROUP BY proposal_id, requested_by_id HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'decision_vetoes holds more than one request per member and proposal; resolve them before migrating';
      END IF;
    END $$;
    CREATE UNIQUE INDEX IF NOT EXISTS "decision_vetoes_one_per_member"
      ON "decision_vetoes" ("proposal_id", "requested_by_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "decision_vetoes_one_per_member";`)
}
