-- Replace plaintext, non-expiring NGO invitation tokens with hashed, expiring tokens.
ALTER TABLE ngo_seats
  ADD COLUMN IF NOT EXISTS invite_token_hash text,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

-- Legacy plaintext invitations cannot be safely migrated without retaining their
-- bearer secret. Revoke them so owners must issue a fresh hardened invitation.
UPDATE ngo_seats
SET status = 'revoked',
    invite_token = NULL,
    invite_token_hash = NULL,
    invite_expires_at = NULL
WHERE status = 'invited' OR invite_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ngo_seats_invite_hash
  ON ngo_seats (invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ngo_seats_active_member
  ON ngo_seats (org_account_id, member_account_id)
  WHERE member_account_id IS NOT NULL AND status = 'active';

