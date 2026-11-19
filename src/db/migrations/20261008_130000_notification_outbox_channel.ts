import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Make notification_outbox the delivery queue for email and push; push has no category, so it goes nullable.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_notification_outbox_channel" AS ENUM('email', 'push');
    ALTER TABLE "notification_outbox"
      ADD COLUMN "channel" "enum_notification_outbox_channel" DEFAULT 'email' NOT NULL,
      ALTER COLUMN "category" DROP NOT NULL;
    CREATE INDEX IF NOT EXISTS "notification_outbox_queued_available_idx"
      ON "notification_outbox" USING btree ("available_at")
      WHERE "status" = 'queued';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "notification_outbox_queued_available_idx";
    UPDATE "notification_outbox" SET "category" = 'announcement' WHERE "category" IS NULL;
    ALTER TABLE "notification_outbox"
      ALTER COLUMN "category" SET NOT NULL,
      DROP COLUMN "channel";
    DROP TYPE "public"."enum_notification_outbox_channel";
  `)
}
