import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Reviewed public pages (FAQ, contact) go through the content draft workflow.
// Postgres cannot drop an enum value, so down() leaves 'page' on the type.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_content_drafts_content_type" ADD VALUE IF NOT EXISTS 'page';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {}
