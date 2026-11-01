import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Personal agent keys for the YOUNGO MCP gateway (src/endpoints/agent.ts).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "credential_epoch" numeric DEFAULT 1;

  CREATE TABLE "agent_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"prefix" varchar NOT NULL,
  	"credential_epoch" numeric NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"last_used_at" timestamp(3) with time zone,
  	"revoked_at" timestamp(3) with time zone,
  	"revoked_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "agent_idempotency" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"agent_key_id" integer NOT NULL,
  	"tool" varchar NOT NULL,
  	"idempotency_key" varchar NOT NULL,
  	"arguments_hash" varchar NOT NULL,
  	"response" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "agent_keys" ADD CONSTRAINT "agent_keys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "agent_idempotency" ADD CONSTRAINT "agent_idempotency_agent_key_id_agent_keys_id_fk" FOREIGN KEY ("agent_key_id") REFERENCES "public"."agent_keys"("id") ON DELETE cascade ON UPDATE no action;

  CREATE INDEX "agent_keys_account_idx" ON "agent_keys" USING btree ("account_id");
  CREATE UNIQUE INDEX "agent_keys_token_hash_idx" ON "agent_keys" USING btree ("token_hash");
  CREATE INDEX "agent_keys_revoked_at_idx" ON "agent_keys" USING btree ("revoked_at");
  CREATE INDEX "agent_idempotency_agent_key_idx" ON "agent_idempotency" USING btree ("agent_key_id");
  -- one stored result per key, tool and idempotency key
  CREATE UNIQUE INDEX "agent_idempotency_unique" ON "agent_idempotency" USING btree ("agent_key_id", "tool", "idempotency_key");
  `)

  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "agent_keys_id" integer,
    ADD COLUMN IF NOT EXISTS "agent_idempotency_id" integer;
  `)
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_agent_keys_fk" FOREIGN KEY ("agent_keys_id") REFERENCES "public"."agent_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_agent_idempotency_fk" FOREIGN KEY ("agent_idempotency_id") REFERENCES "public"."agent_idempotency"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_agent_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("agent_keys_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_agent_idempotency_id_idx" ON "payload_locked_documents_rels" USING btree ("agent_idempotency_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels"
    DROP COLUMN IF EXISTS "agent_keys_id",
    DROP COLUMN IF EXISTS "agent_idempotency_id";
  DROP TABLE "agent_idempotency" CASCADE;
  DROP TABLE "agent_keys" CASCADE;
  ALTER TABLE "accounts" DROP COLUMN IF EXISTS "credential_epoch";
  `)
}
