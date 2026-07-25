-- Align hub_accounts with official YOUNGO Join/Onboarding form fields.
ALTER TABLE hub_accounts
ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS gender_other text,
  ADD COLUMN IF NOT EXISTS age_band text,
  ADD COLUMN IF NOT EXISTS minority_groups text [] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS minority_other text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS motivation text,
  ADD COLUMN IF NOT EXISTS accept_code_of_conduct boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_data_protection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_principles boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_coi_policy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_of_accredited_ngo boolean;
-- Backfill name parts from existing name when missing
UPDATE hub_accounts
SET first_name = COALESCE(first_name, split_part(name, ' ', 1)),
  last_name = COALESCE(
    last_name,
    NULLIF(
      trim(
        substring(
          name
          from position(' ' in name)
        )
      ),
      ''
    )
  )
WHERE first_name IS NULL;
CREATE INDEX IF NOT EXISTS idx_hub_accounts_region ON hub_accounts (region);
CREATE INDEX IF NOT EXISTS idx_hub_accounts_age_band ON hub_accounts (age_band);