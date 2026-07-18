-- NGO contribution points ledger: staff-awarded points for badge support
-- and UNFCCC / constituency submission contributions.

-- Allow NGOs to log badge-support requests (soft work tracking).
ALTER TABLE ngo_requests DROP CONSTRAINT IF EXISTS ngo_requests_kind_check;
ALTER TABLE ngo_requests ADD CONSTRAINT ngo_requests_kind_check
  CHECK (kind IN ('submit', 'endorse', 'represent', 'deadline', 'other', 'badge_support'));

CREATE TABLE IF NOT EXISTS ngo_point_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_account_id  uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  points          integer NOT NULL CHECK (points <> 0),
  reason_code     text NOT NULL
                  CHECK (reason_code IN (
                    'badge_support',
                    'unfccc_submission',
                    'endorse_document',
                    'submit_on_behalf',
                    'represent',
                    'other',
                    'adjustment'
                  )),
  title           text NOT NULL,
  note            text,
  related_type    text,
  related_id      text,
  awarded_by      uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'posted'
                  CHECK (status IN ('posted', 'voided')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  voided_at       timestamptz,
  voided_by       uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  void_reason     text
);

CREATE INDEX IF NOT EXISTS idx_ngo_point_ledger_org
  ON ngo_point_ledger (org_account_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ngo_point_ledger_reason
  ON ngo_point_ledger (reason_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ngo_point_ledger_related
  ON ngo_point_ledger (related_type, related_id)
  WHERE related_id IS NOT NULL;
