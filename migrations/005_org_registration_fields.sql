-- Organisational registration: admitted vs non-admitted UNFCCC NGO paths.
ALTER TABLE hub_accounts
  ADD COLUMN IF NOT EXISTS youth_affiliation text,
  ADD COLUMN IF NOT EXISTS org_operate_in text,
  ADD COLUMN IF NOT EXISTS org_website text,
  ADD COLUMN IF NOT EXISTS org_social text,
  ADD COLUMN IF NOT EXISTS org_mission text,
  ADD COLUMN IF NOT EXISTS dcp_email text,
  ADD COLUMN IF NOT EXISTS dcp_phone text,
  ADD COLUMN IF NOT EXISTS ycp_name text,
  ADD COLUMN IF NOT EXISTS ycp_email text,
  ADD COLUMN IF NOT EXISTS ycp_phone text;

-- organization_type: unfccc_admitted | non_admitted
COMMENT ON COLUMN hub_accounts.organization_type IS 'unfccc_admitted | non_admitted for organisation accounts';
