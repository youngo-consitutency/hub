import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Remove the legacy council_decisions content table — the decision register
// now reads decision_proposals (S09) directly, and the fictional fixture rows
// are gone from the seed. Any remaining rows are the same seeded fixtures, so
// dropping the table loses no operational data.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "council_decisions_id";
  DROP TABLE "council_decisions";
  DROP TYPE "public"."enum_council_decisions_status";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_council_decisions_status" AS ENUM('proposed', 'open_for_input', 'objection_window', 'adopted', 'rejected', 'withdrawn');
  CREATE TABLE "council_decisions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"status" "enum_council_decisions_status" DEFAULT 'proposed' NOT NULL,
  	"summary" varchar,
  	"proposer" varchar DEFAULT 'Focal points',
  	"proposal_url" varchar,
  	"final_url" varchar,
  	"respond_note" varchar,
  	"outcome_note" varchar,
  	"input_deadline" timestamp(3) with time zone,
  	"objection_deadline" timestamp(3) with time zone,
  	"decided_at" timestamp(3) with time zone,
  	"status_log" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE UNIQUE INDEX "council_decisions_slug_idx" ON "council_decisions" USING btree ("slug");
  CREATE INDEX "council_decisions_status_idx" ON "council_decisions" USING btree ("status");
  CREATE INDEX "council_decisions_updated_at_idx" ON "council_decisions" USING btree ("updated_at");
  CREATE INDEX "council_decisions_created_at_idx" ON "council_decisions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "council_decisions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_council_decisions_fk" FOREIGN KEY ("council_decisions_id") REFERENCES "public"."council_decisions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_council_decisions_id_idx" ON "payload_locked_documents_rels" USING btree ("council_decisions_id");
  `)
}
