import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// One ballot per member per proposal, enforced at the database. The index was
// introduced in 20260927_120000_decision_engine; re-asserting it here keeps
// environments whose migration ledger diverged (seeded or imported databases)
// under the same guarantee. IF NOT EXISTS makes this a no-op where it exists.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "decision_ballots_proposal_account_idx"
      ON "decision_ballots" USING btree ("proposal_id", "account_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "decision_ballots_proposal_account_idx";
  `)
}
