-- Let consultation notes point at a slide section.
-- Existing rows stay attached to the whole consultation.

ALTER TABLE consultation_contributions
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'general';

ALTER TABLE consultation_contributions
  DROP CONSTRAINT IF EXISTS consultation_contributions_section_check;

ALTER TABLE consultation_contributions
  ADD CONSTRAINT consultation_contributions_section_check
  CHECK (
    section IN (
      'general',
      'open',
      'aims',
      'need',
      'security',
      'concerns',
      'uses',
      'serve',
      'safeguards',
      'agree',
      'next'
    )
  );

CREATE INDEX IF NOT EXISTS idx_consultation_contributions_section
  ON consultation_contributions (section, created_at DESC);
