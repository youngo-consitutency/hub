-- Multi-user seats for accredited NGO accounts.
CREATE TABLE IF NOT EXISTS ngo_seats (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_account_id    uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  member_account_id uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  email             text NOT NULL,
  name              text,
  seat_role         text NOT NULL DEFAULT 'representative'
                    CHECK (seat_role IN ('owner', 'representative', 'viewer')),
  status            text NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('invited', 'active', 'revoked')),
  invite_token      text UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  accepted_at       timestamptz,
  UNIQUE (org_account_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ngo_seats_org ON ngo_seats (org_account_id, status);
CREATE INDEX IF NOT EXISTS idx_ngo_seats_member ON ngo_seats (member_account_id);
CREATE INDEX IF NOT EXISTS idx_ngo_seats_token ON ngo_seats (invite_token);
