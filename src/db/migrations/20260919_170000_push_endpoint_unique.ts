import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // A push endpoint is a device capability — one row per endpoint regardless of
  // which account holds it, so subscribe can upsert on conflict.
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_endpoint
      ON push_subscriptions (endpoint)
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS uq_push_subscriptions_endpoint`)
}
