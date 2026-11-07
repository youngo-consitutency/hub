import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// votes are cast on belenios now, so the hub's own voter credentials and
// ballots go. elections, candidates, screening and results stay
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DELETE FROM "payload_locked_documents_rels"
   WHERE "election_voters_id" IS NOT NULL OR "election_ballots_id" IS NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_election_voters_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_election_ballots_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_election_voters_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_election_ballots_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "election_voters_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "election_ballots_id";

  DROP TABLE IF EXISTS "election_ballots" CASCADE;
  DROP TABLE IF EXISTS "election_voters" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_election_ballots_kind";
  DROP TYPE IF EXISTS "public"."enum_election_voters_kind";
  `)
}

// restores the empty tables; cast ballots are not recoverable
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_election_voters_kind" AS ENUM('individual', 'organisation');
  CREATE TYPE "public"."enum_election_ballots_kind" AS ENUM('individual', 'organisation');
  CREATE TABLE "election_voters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"election_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"kind" "enum_election_voters_kind" NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"issued_at" timestamp(3) with time zone NOT NULL,
  	"voted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "election_ballots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"election_id" integer NOT NULL,
  	"race" varchar NOT NULL,
  	"voter_token_hash" varchar NOT NULL,
  	"kind" "enum_election_ballots_kind" NOT NULL,
  	"ranks" jsonb NOT NULL,
  	"cast_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "election_voters" ADD CONSTRAINT "election_voters_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "election_voters" ADD CONSTRAINT "election_voters_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "election_ballots" ADD CONSTRAINT "election_ballots_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "election_voters_election_idx" ON "election_voters" USING btree ("election_id");
  CREATE INDEX "election_voters_account_idx" ON "election_voters" USING btree ("account_id");
  CREATE INDEX "election_voters_token_hash_idx" ON "election_voters" USING btree ("token_hash");
  CREATE UNIQUE INDEX "election_voters_election_account_idx" ON "election_voters" USING btree ("election_id", "account_id");
  CREATE INDEX "election_ballots_election_idx" ON "election_ballots" USING btree ("election_id");
  CREATE INDEX "election_ballots_race_idx" ON "election_ballots" USING btree ("race");
  CREATE INDEX "election_ballots_voter_token_hash_idx" ON "election_ballots" USING btree ("voter_token_hash");
  CREATE UNIQUE INDEX "election_ballots_election_race_token_idx" ON "election_ballots" USING btree ("election_id", "race", "voter_token_hash");
  CREATE UNIQUE INDEX "election_ballots_election_race_voter_idx" ON "election_ballots" USING btree ("election_id", "race", "voter_token_hash");
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "election_voters_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "election_ballots_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_election_voters_fk" FOREIGN KEY ("election_voters_id") REFERENCES "public"."election_voters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_election_ballots_fk" FOREIGN KEY ("election_ballots_id") REFERENCES "public"."election_ballots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_election_voters_id_idx" ON "payload_locked_documents_rels" USING btree ("election_voters_id");
  CREATE INDEX "payload_locked_documents_rels_election_ballots_id_idx" ON "payload_locked_documents_rels" USING btree ("election_ballots_id");
  `)
}
