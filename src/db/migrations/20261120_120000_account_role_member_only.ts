import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// `accounts.role` is reduced to the technical account kind — 'member' only.
// Every authority value it used to mirror (admin, focal_point, wg_contact,
// ngo_admin) now lives in `authority_records`, so the column is flattened
// and the enum narrowed to prevent the parallel store from reappearing.
//
// Postgres cannot remove values from an enum type, so the type is rebuilt.
// The column default must be dropped before the type change — Postgres
// cannot cast a default expression automatically — and is restored after.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "accounts" SET "role"='member' WHERE "role" <> 'member';

  ALTER TYPE "public"."enum_accounts_role" RENAME TO "enum_accounts_role_old";
  CREATE TYPE "public"."enum_accounts_role" AS ENUM('member');
  ALTER TABLE "accounts" ALTER COLUMN "role" DROP DEFAULT;
  ALTER TABLE "accounts" ALTER COLUMN "role" TYPE "enum_accounts_role" USING 'member'::"enum_accounts_role";
  ALTER TABLE "accounts" ALTER COLUMN "role" SET DEFAULT 'member'::"enum_accounts_role";
  DROP TYPE "public"."enum_accounts_role_old";
  `)
}

// The enum widens back to its former values; flattened rows stay 'member' —
// which account held which mandate cannot be reconstructed from a label, and
// authority_records is the authoritative history either way.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_accounts_role" RENAME TO "enum_accounts_role_old";
  CREATE TYPE "public"."enum_accounts_role" AS ENUM('member', 'admin', 'focal_point', 'wg_contact', 'ngo_admin');
  ALTER TABLE "accounts" ALTER COLUMN "role" DROP DEFAULT;
  ALTER TABLE "accounts" ALTER COLUMN "role" TYPE "enum_accounts_role" USING "role"::text::"enum_accounts_role";
  ALTER TABLE "accounts" ALTER COLUMN "role" SET DEFAULT 'member'::"enum_accounts_role";
  DROP TYPE "public"."enum_accounts_role_old";
  `)
}
