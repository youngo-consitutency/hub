-- Rejected applicants can appeal with identity proof. Bytes stay off the
-- ordinary account record and are visible only to Membership Team / admins.

CREATE TABLE IF NOT EXISTS membership_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'granted', 'upheld')
  ),
  identity_kind text NOT NULL CHECK (
    identity_kind IN (
      'passport',
      'national_id',
      'organisational_letter',
      'other'
    )
  ),
  statement text NOT NULL,
  proof_content_type text NOT NULL CHECK (
    proof_content_type IN (
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    )
  ),
  proof_bytes bytea NOT NULL,
  proof_byte_size integer NOT NULL CHECK (
    proof_byte_size > 0
    AND proof_byte_size <= 2097152
  ),
  reviewer_id uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_membership_appeals_account
  ON membership_appeals (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_membership_appeals_open
  ON membership_appeals (status, created_at DESC)
  WHERE status = 'submitted';

CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_appeals_open
  ON membership_appeals (account_id)
  WHERE status = 'submitted';
