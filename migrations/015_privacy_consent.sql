-- Explicit, recorded privacy consent — distinct from Membership Policy acceptance.
--
-- Accepting the Membership Policy says "I understand what membership means".
-- Privacy consent says "I agree to this platform processing my personal data".
-- They are recorded separately so consent can be evidenced, audited, and withdrawn
-- on its own, and so a notice change can re-prompt without touching policy state.
ALTER TABLE hub_accounts
  ADD COLUMN IF NOT EXISTS privacy_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_notice_version text,
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_consent_statement text,
  ADD COLUMN IF NOT EXISTS privacy_consent_withdrawn_at timestamptz;

-- Accounts that registered before this migration have not given consent under any
-- notice version. Leaving them false is deliberate: they are re-prompted rather
-- than presumed to have agreed to a notice that did not exist when they signed up.
COMMENT ON COLUMN hub_accounts.privacy_consent IS
  'True only where the member actively consented to a specific privacy notice version.';
COMMENT ON COLUMN hub_accounts.privacy_notice_version IS
  'PRIVACY_VERSION from shared/privacyNotice.js at the moment consent was given.';

CREATE INDEX IF NOT EXISTS idx_hub_accounts_privacy_consent
  ON hub_accounts (privacy_notice_version, privacy_consent);
