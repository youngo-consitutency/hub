import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Mail Desk drafts. Writes flow through src/endpoints/mail.ts.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_mail_drafts_scope_type" AS ENUM('working_group', 'constituency', 'individual');
  CREATE TYPE "public"."enum_mail_drafts_status" AS ENUM('draft', 'queued', 'discarded');

  CREATE TABLE "mail_drafts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"author_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"message" varchar NOT NULL,
  	"action_url" varchar,
  	"scope_type" "enum_mail_drafts_scope_type" NOT NULL,
  	"wg_slug" varchar,
  	"recipients" jsonb,
  	"status" "enum_mail_drafts_status" DEFAULT 'draft' NOT NULL,
  	"campaign_id" varchar,
  	"recipient_count" numeric,
  	"queued_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "mail_drafts" ADD CONSTRAINT "mail_drafts_author_id_accounts_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "mail_drafts_author_idx" ON "mail_drafts" USING btree ("author_id");
  CREATE INDEX "mail_drafts_status_idx" ON "mail_drafts" USING btree ("status");
  `)

  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "mail_drafts_id" integer;
  `)
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mail_drafts_fk" FOREIGN KEY ("mail_drafts_id") REFERENCES "public"."mail_drafts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_mail_drafts_id_idx" ON "payload_locked_documents_rels" USING btree ("mail_drafts_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "mail_drafts_id";
  DROP TABLE "mail_drafts" CASCADE;
  DROP TYPE "public"."enum_mail_drafts_scope_type";
  DROP TYPE "public"."enum_mail_drafts_status";
  `)
}
