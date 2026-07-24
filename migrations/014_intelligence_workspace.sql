CREATE TABLE IF NOT EXISTS intelligence_queries (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  audience text NOT NULL CHECK (audience IN ('public','member','mandate','operations')),
  query_text text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intelligence_queries_created ON intelligence_queries(created_at DESC);

CREATE TABLE IF NOT EXISTS intelligence_writebacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_by uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('save_research_note')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','applied','failed')),
  approved_by uuid REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  applied_by uuid REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  approval_reason text,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  applied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proposed_by,idempotency_key)
);

CREATE TABLE IF NOT EXISTS intelligence_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  writeback_id uuid UNIQUE NOT NULL REFERENCES intelligence_writebacks(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
