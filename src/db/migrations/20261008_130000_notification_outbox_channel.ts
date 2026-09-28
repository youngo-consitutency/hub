import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Turn notification_outbox into the single delivery queue for both channels.
// Email rows keep their preference category; push jobs have none, so the
// column goes nullable. lease_until + available_at (already present) provide
// claiming and retry scheduling — the partial index covers the claim scan.
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
