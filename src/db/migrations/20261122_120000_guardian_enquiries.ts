import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Guardian pathway for under-18 applicants. Writes flow through
// src/endpoints/auth.ts and src/endpoints/membershipTeam.ts.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_guardian_enquiries_relationship" AS ENUM('parent', 'legal_guardian');

  CREATE TABLE "guardian_enquiries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"guardian_name" varchar NOT NULL,
  	"guardian_email" varchar NOT NULL,
  	"relationship" "enum_guardian_enquiries_relationship" NOT NULL,
  	"consent_statement" varchar NOT NULL,
  	"consented_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE INDEX "guardian_enquiries_created_at_idx" ON "guardian_enquiries" USING btree ("created_at");
  `)

  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "guardian_enquiries_id" integer;
  `)
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_guardian_enquiries_fk" FOREIGN KEY ("guardian_enquiries_id") REFERENCES "public"."guardian_enquiries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_guardian_enquiries_id_idx" ON "payload_locked_documents_rels" USING btree ("guardian_enquiries_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "guardian_enquiries_id";
  DROP TABLE "guardian_enquiries" CASCADE;
  DROP TYPE "public"."enum_guardian_enquiries_relationship";
  `)
}
