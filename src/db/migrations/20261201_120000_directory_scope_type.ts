import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// directory rows keep the scope type their role applies to
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "directory_contacts" ADD COLUMN IF NOT EXISTS "scope_type" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "directory_contacts" DROP COLUMN IF EXISTS "scope_type";
  `)
}
