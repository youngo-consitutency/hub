import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// A sign-up waits here until the person confirms their email address; only then does an account
// exist (src/lib/pendingRegistration.ts). Rows are short-lived and the payload is encrypted.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pending_registrations" (
      "email" text PRIMARY KEY,
      "token_hash" text NOT NULL UNIQUE,
      "payload_enc" text NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "pending_registrations_expires_at_idx"
      ON "pending_registrations" ("expires_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "pending_registrations";`)
}
