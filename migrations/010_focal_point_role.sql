-- Focal Points are platform mandate holders and the primary constituency
-- representatives to the UNFCCC secretariat.
ALTER TABLE hub_accounts
  DROP CONSTRAINT IF EXISTS hub_accounts_role_check;

ALTER TABLE hub_accounts
  DROP CONSTRAINT IF EXISTS hub_accounts_role_valid;

ALTER TABLE hub_accounts
  ADD CONSTRAINT hub_accounts_role_valid CHECK (
    role IN ('member', 'focal_point', 'wg_contact', 'ngo_admin', 'admin')
  );
