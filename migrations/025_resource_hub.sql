-- Public science-resource catalogue using the existing independently reviewed
-- content workflow. Ordinary verified members may author resource revisions;
-- only accounts with content review/publish capabilities may approve them.
ALTER TABLE hub_content_revisions
  DROP CONSTRAINT IF EXISTS hub_content_revisions_content_type_check;
ALTER TABLE hub_content_revisions
  ADD CONSTRAINT hub_content_revisions_content_type_check
  CHECK (content_type IN ('event', 'announcement', 'resource'));

ALTER TABLE hub_content_publications
  DROP CONSTRAINT IF EXISTS hub_content_publications_content_type_check;
ALTER TABLE hub_content_publications
  ADD CONSTRAINT hub_content_publications_content_type_check
  CHECK (content_type IN ('event', 'announcement', 'resource'));

CREATE INDEX IF NOT EXISTS idx_hub_resource_publications
  ON hub_content_publications (published_at DESC)
  WHERE content_type = 'resource';
