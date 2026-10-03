import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Appointments: the table of mandated responsibilities (S13/S14/S15/S25).
// Distinct from `assignments`, which remains the participation ledger
// (working-group/body membership, negotiation scopes). One account may hold
// a role on a scope only once at a time — the partial unique index prevents
// duplicate appointments under concurrency. `assignments.status` gains
// 'revoked' so ended mandates are distinguishable from ordinary inactivity.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_appointments_appointment_role" AS ENUM('focal_point', 'council.substitute', 'org.representative', 'org.member', 'org.admin', 'wg.member', 'wg.contact_point', 'wg.safeguarding_officer', 'ot.member', 'ot.liaison', 'body.member', 'body.coordinator', 'body.contact_point', 'body.liaison', 'body.council_representative', 'gct.coordinator', 'gct.partnerships', 'gct.membership', 'gct.finance', 'gct.internal', 'gct.coordination', 'team.membership', 'team.selections', 'team.election_facilitation', 'team.awareness', 'team.safeguarding', 'team.finance', 'team.partnerships', 'team.comms', 'team.reforms', 'team.data_controller', 'team.gys_policy', 'content.editor', 'content.publisher', 'coy.lcoy_liaison', 'coy.rcoy_liaison', 'coy.gcoy_liaison', 'cct.member', 'cct.coordinator', 'negotiation.member', 'negotiation.reviewer', 'negotiation.applier', 'negotiation.grant_manager', 'negotiation.process_facilitator', 'negotiation.transmitter');
  CREATE TYPE "public"."enum_appointments_scope_type" AS ENUM('platform', 'organisation', 'working_group', 'operational_team', 'body', 'team', 'event', 'negotiation_track', 'negotiation_project');
  CREATE TYPE "public"."enum_appointments_status" AS ENUM('active', 'inactive', 'expired', 'revoked');

  CREATE TABLE "appointments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"appointment_role" "enum_appointments_appointment_role" NOT NULL,
  	"scope_type" "enum_appointments_scope_type" NOT NULL,
  	"scope_id" varchar NOT NULL,
  	"council_seat" varchar,
  	"substitute_for_id" integer,
  	"status" "enum_appointments_status" DEFAULT 'active' NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"ends_at" timestamp(3) with time zone,
  	"appointed_via" jsonb,
  	"appointed_by_id" integer,
  	"evidence" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_substitute_for_id_appointments_id_fk" FOREIGN KEY ("substitute_for_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_appointed_by_id_accounts_id_fk" FOREIGN KEY ("appointed_by_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;

  CREATE INDEX "appointments_account_idx" ON "appointments" USING btree ("account_id");
  CREATE INDEX "appointments_appointment_role_idx" ON "appointments" USING btree ("appointment_role");
  CREATE INDEX "appointments_scope_id_idx" ON "appointments" USING btree ("scope_id");
  CREATE INDEX "appointments_status_idx" ON "appointments" USING btree ("status");
  CREATE INDEX "appointments_council_seat_idx" ON "appointments" USING btree ("council_seat");
  CREATE UNIQUE INDEX "appointments_active_scope_unique" ON "appointments" USING btree ("account_id", "appointment_role", "scope_type", "scope_id") WHERE "status" = 'active';

  -- Payload's document-lock registry keeps one rels column per collection.
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "appointments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_appointments_fk" FOREIGN KEY ("appointments_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_appointments_id_idx" ON "payload_locked_documents_rels" USING btree ("appointments_id");

  ALTER TYPE "public"."enum_assignments_status" ADD VALUE IF NOT EXISTS 'revoked';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_appointments_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_appointments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "appointments_id";
  DROP TABLE "appointments";
  DROP TYPE "public"."enum_appointments_appointment_role";
  DROP TYPE "public"."enum_appointments_scope_type";
  DROP TYPE "public"."enum_appointments_status";
  `)
}
