import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Re-assert the one-ballot-per-member index for environments whose migration ledger diverged.
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
