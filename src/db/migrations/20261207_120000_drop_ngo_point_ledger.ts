import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Contribution points were retired and nothing reads or writes this ledger any more.
// Destructive on production: branch Neon (pre-migrate-YYYY-MM-DD) before this runs.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "ngo_point_ledger" CASCADE;`)
}

// restores the empty table only; the rows are not recoverable from here
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ngo_point_ledger" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "org_account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
      "points" integer NOT NULL CHECK (points <> 0),
      "reason_code" text NOT NULL CHECK (reason_code IN (
        'badge_support','unfccc_submission','endorse_document',
        'submit_on_behalf','represent','other','adjustment')),
      "title" text NOT NULL,
      "note" text,
      "related_type" text,
      "related_id" text,
      "awarded_by" integer REFERENCES "accounts"("id") ON DELETE SET NULL,
      "status" text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','voided')),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "voided_at" timestamptz,
      "voided_by" integer REFERENCES "accounts"("id") ON DELETE SET NULL,
      "void_reason" text
    );
    CREATE INDEX IF NOT EXISTS "idx_ngo_point_ledger_org" ON "ngo_point_ledger" ("org_account_id","status","created_at" DESC);
    CREATE INDEX IF NOT EXISTS "idx_ngo_point_ledger_reason" ON "ngo_point_ledger" ("reason_code","created_at" DESC);
    CREATE INDEX IF NOT EXISTS "idx_ngo_point_ledger_related" ON "ngo_point_ledger" ("related_type","related_id") WHERE related_id IS NOT NULL;
  `)
}
