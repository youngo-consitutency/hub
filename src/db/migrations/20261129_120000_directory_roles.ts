import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// directory rows name the role they stand for, so holders come from
// authority-records. structure only; the row mapping is scripts/setup/map-directory-roles.ts
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "directory_contacts" ADD COLUMN IF NOT EXISTS "role" varchar;
  ALTER TABLE "directory_contacts" ADD COLUMN IF NOT EXISTS "scope_id" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "directory_contacts" DROP COLUMN IF EXISTS "scope_id";
  ALTER TABLE "directory_contacts" DROP COLUMN IF EXISTS "role";
  `)
}
