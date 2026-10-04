import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// `accounts.role` narrows to the technical kind 'member' — its former
// authority values now live in `authority_records`. Postgres can't remove
// enum values, so the type is rebuilt (drop default → retype → restore).
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

// Rollback widens the enum but rows stay 'member' — authority_records is the
// authoritative history either way.
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
