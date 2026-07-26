-- Individuals can ask to be linked to their organisation, and the organisation
-- decides. Until now seats only travelled the other way (org invites person),
-- so the status set had no room for a request awaiting a decision.
--
-- 'affiliate' is a seat role that records the link without granting any access
-- to the organisation's portal data: authorization.js only admits viewer,
-- representative and owner.
ALTER TABLE ngo_seats DROP CONSTRAINT IF EXISTS ngo_seats_status_check;

ALTER TABLE ngo_seats
ADD CONSTRAINT ngo_seats_status_check CHECK (
  status IN ('invited', 'requested', 'active', 'revoked', 'declined')
);

ALTER TABLE ngo_seats DROP CONSTRAINT IF EXISTS ngo_seats_seat_role_check;

ALTER TABLE ngo_seats
ADD CONSTRAINT ngo_seats_seat_role_check CHECK (
  seat_role IN ('owner', 'representative', 'viewer', 'affiliate')
);

-- Requests are read per organisation when building the approval queue.
CREATE INDEX IF NOT EXISTS idx_ngo_seats_requested ON ngo_seats (org_account_id)
WHERE
  status = 'requested';

-- A person's own affiliations are read on their profile.
CREATE INDEX IF NOT EXISTS idx_ngo_seats_member_status ON ngo_seats (member_account_id, status);
