import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Fixed-window request counters shared by every serverless instance (src/lib/rateLimit.ts).
// Not a Payload collection: it is written on every limited request and never read through the API.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "rate_limits" (
      "key" text PRIMARY KEY,
      "count" integer NOT NULL,
      "reset_at" timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "rate_limits_reset_at_idx" ON "rate_limits" ("reset_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "rate_limits";`)
}
