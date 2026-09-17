-- Contact Point section calls. Hosts (Genn / Jalo) publish slots; CPs book
-- from the Hub instead of negotiating times in WhatsApp.

CREATE TABLE IF NOT EXISTS cp_call_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_account_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  host_label text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'booked', 'cancelled')),
  booked_by uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  booked_at timestamptz,
  wg_slug text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_cp_call_slots_open
  ON cp_call_slots (starts_at)
  WHERE status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_call_slots_host_start
  ON cp_call_slots (host_account_id, starts_at)
  WHERE status <> 'cancelled';
