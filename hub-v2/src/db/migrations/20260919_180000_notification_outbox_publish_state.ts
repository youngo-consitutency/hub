import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Email notification outbox (announcement broadcasts / audit of sends).
  await db.execute(sql`
    CREATE TYPE "public"."enum_notification_outbox_category" AS ENUM('digest', 'deadline', 'announcement');
    CREATE TYPE "public"."enum_notification_outbox_status" AS ENUM('queued', 'sent', 'failed', 'suppressed');
    CREATE TABLE "notification_outbox" (
      "id" serial PRIMARY KEY NOT NULL,
      "account_id" integer NOT NULL,
      "category" "enum_notification_outbox_category" NOT NULL,
      "template_key" varchar NOT NULL,
      "source_type" varchar,
      "source_id" varchar,
      "deduplication_key" varchar NOT NULL,
      "payload" jsonb,
      "available_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "status" "enum_notification_outbox_status" DEFAULT 'queued' NOT NULL,
      "attempts" numeric DEFAULT 0,
      "lease_until" timestamp(3) with time zone,
      "provider_message_id" varchar,
      "last_error_code" varchar,
      "sent_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_account_id_accounts_id_fk"
      FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "notification_outbox_account_idx" ON "notification_outbox" USING btree ("account_id");
    CREATE UNIQUE INDEX "notification_outbox_deduplication_key_idx" ON "notification_outbox" USING btree ("deduplication_key");
    CREATE INDEX "notification_outbox_status_idx" ON "notification_outbox" USING btree ("status");
    CREATE INDEX "notification_outbox_available_at_idx" ON "notification_outbox" USING btree ("available_at");
  `)

  // Organisation posting-trust override (ngo_opportunity_trust equivalent).
  await db.execute(sql`
    CREATE TYPE "public"."enum_accounts_posting_trust" AS ENUM('trusted', 'review_required');
    ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "posting_trust" "enum_accounts_posting_trust";
  `)

  // Publication state on live content (unpublish hides it everywhere).
  await db.execute(sql`
    CREATE TYPE "public"."enum_content_events_state" AS ENUM('published', 'unpublished');
    ALTER TABLE "content_events" ADD COLUMN IF NOT EXISTS "state" "enum_content_events_state" DEFAULT 'published' NOT NULL;
    CREATE INDEX IF NOT EXISTS "content_events_state_idx" ON "content_events" USING btree ("state");
    CREATE TYPE "public"."enum_content_announcements_state" AS ENUM('published', 'unpublished');
    ALTER TABLE "content_announcements" ADD COLUMN IF NOT EXISTS "state" "enum_content_announcements_state" DEFAULT 'published' NOT NULL;
    CREATE INDEX IF NOT EXISTS "content_announcements_state_idx" ON "content_announcements" USING btree ("state");
  `)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "notification_outbox_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_outbox_fk"
      FOREIGN KEY ("notification_outbox_id") REFERENCES "public"."notification_outbox"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_notification_outbox_id_idx"
      ON "payload_locked_documents_rels" USING btree ("notification_outbox_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "notification_outbox_id";
    ALTER TABLE "content_announcements" DROP COLUMN IF EXISTS "state";
    ALTER TABLE "content_events" DROP COLUMN IF EXISTS "state";
    ALTER TABLE "accounts" DROP COLUMN IF EXISTS "posting_trust";
    DROP TABLE IF EXISTS "notification_outbox";
    DROP TYPE IF EXISTS "public"."enum_notification_outbox_status";
    DROP TYPE IF EXISTS "public"."enum_notification_outbox_category";
    DROP TYPE IF EXISTS "public"."enum_accounts_posting_trust";
    DROP TYPE IF EXISTS "public"."enum_content_events_state";
    DROP TYPE IF EXISTS "public"."enum_content_announcements_state";
  `)
}
