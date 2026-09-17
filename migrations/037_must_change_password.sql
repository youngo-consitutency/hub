-- Roster-seeded Contact Point accounts share a temporary password. After they
-- sign in they must set their own. Ordinary registrations stay false.

ALTER TABLE hub_accounts
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

UPDATE hub_accounts
   SET must_change_password = true
 WHERE verified_by = 'mandate_roster_2026'
   AND must_change_password = false;
