-- Live content can be unpublished without deleting history. Same-slug
-- publish already replaced hub_content_publications rows; this status
-- keeps fixture-backed items hidden after unpublish until republished.
ALTER TABLE hub_content_publications
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
ALTER TABLE hub_content_publications
  DROP CONSTRAINT IF EXISTS hub_content_publications_status_check;
ALTER TABLE hub_content_publications
  ADD CONSTRAINT hub_content_publications_status_check
  CHECK (status IN ('published', 'unpublished'));
ALTER TABLE hub_content_publications
  ADD COLUMN IF NOT EXISTS unpublished_by uuid REFERENCES hub_accounts(id) ON DELETE SET NULL;
ALTER TABLE hub_content_publications
  ADD COLUMN IF NOT EXISTS unpublished_at timestamptz;
ALTER TABLE hub_content_publications
  ADD COLUMN IF NOT EXISTS unpublish_reason text;
CREATE INDEX IF NOT EXISTS idx_hub_content_publications_status
  ON hub_content_publications (content_type, status, published_at DESC);
