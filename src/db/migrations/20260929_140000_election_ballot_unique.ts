import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// One ballot per credential per race, enforced in the database (check-then-insert raced).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "election_ballots_election_race_voter_idx"
      ON "election_ballots" USING btree ("election_id", "race", "voter_token_hash");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "election_ballots_election_race_voter_idx";
  `)
}
