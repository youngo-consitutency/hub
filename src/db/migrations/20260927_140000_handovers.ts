import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// S17 handover records: checklist + deadline when membership or a mandate
// ends. Writes flow through src/endpoints/membership.ts.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_handovers_reason" AS ENUM('resignation', 'termination', 'cw_expiry', 'mandate_end', 'other');
  CREATE TYPE "public"."enum_handovers_status" AS ENUM('open', 'completed', 'overdue', 'waived');

  CREATE TABLE "handovers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"reason" "enum_handovers_reason" NOT NULL,
  	"scope_label" varchar NOT NULL,
  	"due_at" timestamp(3) with time zone NOT NULL,
  	"status" "enum_handovers_status" DEFAULT 'open' NOT NULL,
  	"notes" varchar,
  	"opened_by_id" integer NOT NULL,
  	"opened_at" timestamp(3) with time zone NOT NULL,
  	"closed_at" timestamp(3) with time zone,
  	"closed_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "handovers_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"done" boolean DEFAULT false,
  	"done_at" timestamp(3) with time zone
  );
  `)

  await db.execute(sql`
  ALTER TABLE "handovers" ADD CONSTRAINT "handovers_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "handovers" ADD CONSTRAINT "handovers_opened_by_id_accounts_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "handovers" ADD CONSTRAINT "handovers_closed_by_id_accounts_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "handovers_items" ADD CONSTRAINT "handovers_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."handovers"("id") ON DELETE cascade ON UPDATE no action;
  `)

  await db.execute(sql`
  CREATE INDEX "handovers_account_idx" ON "handovers" USING btree ("account_id");
  CREATE INDEX "handovers_reason_idx" ON "handovers" USING btree ("reason");
  CREATE INDEX "handovers_status_idx" ON "handovers" USING btree ("status");
  CREATE INDEX "handovers_opened_by_idx" ON "handovers" USING btree ("opened_by_id");
  CREATE INDEX "handovers_items_order_idx" ON "handovers_items" USING btree ("_order");
  CREATE INDEX "handovers_items_parent_idx" ON "handovers_items" USING btree ("_parent_id");
  `)

  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "handovers_id" integer;
  `)
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_handovers_fk" FOREIGN KEY ("handovers_id") REFERENCES "public"."handovers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_handovers_id_idx" ON "payload_locked_documents_rels" USING btree ("handovers_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "handovers_id";
  DROP TABLE "handovers_items" CASCADE;
  DROP TABLE "handovers" CASCADE;
  DROP TYPE "public"."enum_handovers_reason";
  DROP TYPE "public"."enum_handovers_status";
  `)
}
