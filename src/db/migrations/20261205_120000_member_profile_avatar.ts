import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// avatar builder choices (allowlisted option keys only, see src/shared/avatar.ts).
// nullable: no row value means the seeded default avatar
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "member_profiles" ADD COLUMN IF NOT EXISTS "avatar" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "member_profiles" DROP COLUMN IF EXISTS "avatar";
  `)
}
