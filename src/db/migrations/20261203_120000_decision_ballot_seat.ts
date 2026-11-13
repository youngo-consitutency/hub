import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// one council ballot per seat. the column is nullable and existing rows stay
// null (nulls never collide), so this can't fail on existing data
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "decision_ballots" ADD COLUMN IF NOT EXISTS "seat" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "decision_ballots_proposal_seat_idx"
      ON "decision_ballots" USING btree ("proposal_id", "seat");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "decision_ballots_proposal_seat_idx";
    ALTER TABLE "decision_ballots" DROP COLUMN IF EXISTS "seat";
  `)
}
