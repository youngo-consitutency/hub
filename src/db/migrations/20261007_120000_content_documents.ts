import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Structured content documents (onboarding courses, policy catalogues,
// contact lists) — CMS-owned so copy lives in the database, not the bundle.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "content_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"body" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE UNIQUE INDEX "content_documents_slug_idx" ON "content_documents" USING btree ("slug");
  CREATE INDEX "content_documents_updated_at_idx" ON "content_documents" USING btree ("updated_at");
  CREATE INDEX "content_documents_created_at_idx" ON "content_documents" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "content_documents_id" integer;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "content_documents_id";
  DROP TABLE "content_documents";
  `)
}
