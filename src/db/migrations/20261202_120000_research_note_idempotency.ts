import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// one note per (author, idempotency key) — the endpoint lookup is just a fast path
// fails if duplicates already exist, so clear those by hand first
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "research_notes_account_idempotency_key_idx"
      ON "research_notes" USING btree ("account_id", "idempotency_key")
      WHERE "idempotency_key" IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "research_notes_account_idempotency_key_idx";
  `)
}
