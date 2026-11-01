import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// COY live operations (allowlist, notices) and the opt-out group_mail email
// category they deliver through.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_notification_outbox_category" ADD VALUE IF NOT EXISTS 'group_mail';
  ALTER TABLE "content_coys" ADD COLUMN IF NOT EXISTS "live_ops" boolean DEFAULT false;

  CREATE TABLE "coy_participants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coy_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"email" varchar NOT NULL,
  	"note" varchar,
  	"added_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "coy_notices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coy_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"channels" jsonb,
  	"campaign_id" varchar,
  	"author_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  `)

  await db.execute(sql`
  ALTER TABLE "coy_participants" ADD CONSTRAINT "coy_participants_coy_id_content_coys_id_fk" FOREIGN KEY ("coy_id") REFERENCES "public"."content_coys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coy_participants" ADD CONSTRAINT "coy_participants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coy_participants" ADD CONSTRAINT "coy_participants_added_by_id_accounts_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coy_notices" ADD CONSTRAINT "coy_notices_coy_id_content_coys_id_fk" FOREIGN KEY ("coy_id") REFERENCES "public"."content_coys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coy_notices" ADD CONSTRAINT "coy_notices_author_id_accounts_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;

  CREATE INDEX "coy_participants_coy_idx" ON "coy_participants" USING btree ("coy_id");
  CREATE INDEX "coy_participants_account_idx" ON "coy_participants" USING btree ("account_id");
  CREATE INDEX "coy_participants_added_by_idx" ON "coy_participants" USING btree ("added_by_id");
  -- one allowlist row per account per conference
  CREATE UNIQUE INDEX "coy_participants_coy_account_unique" ON "coy_participants" USING btree ("coy_id", "account_id");
  CREATE INDEX "coy_notices_coy_idx" ON "coy_notices" USING btree ("coy_id");
  CREATE INDEX "coy_notices_author_idx" ON "coy_notices" USING btree ("author_id");
  CREATE UNIQUE INDEX "coy_notices_campaign_id_idx" ON "coy_notices" USING btree ("campaign_id");
  CREATE INDEX "coy_notices_created_at_idx" ON "coy_notices" USING btree ("created_at");
  `)

  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "coy_participants_id" integer,
    ADD COLUMN IF NOT EXISTS "coy_notices_id" integer;
  `)
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coy_participants_fk" FOREIGN KEY ("coy_participants_id") REFERENCES "public"."coy_participants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coy_notices_fk" FOREIGN KEY ("coy_notices_id") REFERENCES "public"."coy_notices"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_coy_participants_id_idx" ON "payload_locked_documents_rels" USING btree ("coy_participants_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_coy_notices_id_idx" ON "payload_locked_documents_rels" USING btree ("coy_notices_id");
  `)
}

// Postgres cannot drop an enum value; group_mail stays on the type.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    DROP COLUMN IF EXISTS "coy_participants_id",
    DROP COLUMN IF EXISTS "coy_notices_id";
  DROP TABLE "coy_notices" CASCADE;
  DROP TABLE "coy_participants" CASCADE;
  ALTER TABLE "content_coys" DROP COLUMN IF EXISTS "live_ops";
  `)
}
