-- S1 negotiation tracking: durable tracks and agenda lineage, immutable source
-- versions, verified calls, source health and account-scoped follows.

ALTER TABLE account_assignments
  DROP CONSTRAINT IF EXISTS account_assignments_scope_type_check;
ALTER TABLE account_assignments
  ADD CONSTRAINT account_assignments_scope_type_check CHECK (
    scope_type IN (
      'platform','team','working_group','organization',
      'negotiation_track','negotiation_project'
    )
  );

CREATE TABLE IF NOT EXISTS negotiation_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  topic text NOT NULL,
  summary text,
  activity_status text NOT NULL DEFAULT 'active'
    CHECK (activity_status IN ('active','watching','dormant','archived')),
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft','published','retracted')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (publication_status <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS negotiation_track_working_groups (
  track_id uuid NOT NULL REFERENCES negotiation_tracks(id) ON DELETE CASCADE,
  working_group_slug text NOT NULL,
  PRIMARY KEY (track_id, working_group_slug)
);

CREATE TABLE IF NOT EXISTS negotiation_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL,
  session text NOT NULL,
  item_number text NOT NULL,
  sub_item_number text,
  official_title text NOT NULL,
  mandate_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (body, session, item_number, sub_item_number)
);

CREATE TABLE IF NOT EXISTS negotiation_track_agenda_items (
  track_id uuid NOT NULL REFERENCES negotiation_tracks(id) ON DELETE CASCADE,
  agenda_item_id uuid NOT NULL REFERENCES negotiation_agenda_items(id) ON DELETE RESTRICT,
  PRIMARY KEY (track_id, agenda_item_id)
);

CREATE TABLE IF NOT EXISTS negotiation_agenda_lineage (
  from_agenda_item_id uuid NOT NULL REFERENCES negotiation_agenda_items(id) ON DELETE RESTRICT,
  to_agenda_item_id uuid NOT NULL REFERENCES negotiation_agenda_items(id) ON DELETE RESTRICT,
  evidence_note text NOT NULL,
  source_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_agenda_item_id, to_agenda_item_id),
  CHECK (from_agenda_item_id <> to_agenda_item_id)
);

CREATE TABLE IF NOT EXISTS negotiation_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('document','call','agenda','actor_publication')),
  permitted boolean NOT NULL DEFAULT false,
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft','published','disabled')),
  last_successful_check_at timestamptz,
  last_attempt_at timestamptz,
  last_attempt_status text CHECK (last_attempt_status IN ('succeeded','failed','blocked')),
  coverage_state text NOT NULL DEFAULT 'unverified'
    CHECK (coverage_state IN ('current','stale','incomplete','unverified')),
  safe_diagnostic text,
  allowed_redirect_hosts text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_url, source_kind)
);

CREATE TABLE IF NOT EXISTS negotiation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES negotiation_sources(id) ON DELETE RESTRICT,
  source_identifier text,
  title text NOT NULL,
  document_type text NOT NULL,
  document_status text NOT NULL
    CHECK (document_status IN ('unverified','informal','official','adopted','withdrawn')),
  status_verified boolean NOT NULL DEFAULT false,
  body text,
  session text,
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft','published','retracted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS negotiation_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES negotiation_documents(id) ON DELETE RESTRICT,
  content_hash text NOT NULL,
  language text NOT NULL,
  original_reference text NOT NULL,
  final_source_url text NOT NULL,
  media_type text NOT NULL,
  content_size_bytes integer NOT NULL CHECK (content_size_bytes >= 0),
  original_content bytea NOT NULL,
  quarantine_status text NOT NULL DEFAULT 'pending_review'
    CHECK (quarantine_status IN ('pending_review','safe','quarantined')),
  quarantine_reason text,
  extracted_text text,
  published_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  extraction_method text NOT NULL,
  extraction_version text NOT NULL,
  extraction_confidence numeric(5,4),
  supersedes_version_id uuid REFERENCES negotiation_document_versions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, content_hash),
  CHECK (extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1)
);

ALTER TABLE negotiation_agenda_lineage
  ADD CONSTRAINT negotiation_agenda_lineage_source_version_fk
  FOREIGN KEY (source_version_id) REFERENCES negotiation_document_versions(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS negotiation_track_documents (
  track_id uuid NOT NULL REFERENCES negotiation_tracks(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES negotiation_documents(id) ON DELETE RESTRICT,
  PRIMARY KEY (track_id, document_id)
);

CREATE TABLE IF NOT EXISTS negotiation_document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id uuid NOT NULL REFERENCES negotiation_document_versions(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  content_hash text NOT NULL,
  text_content text,
  extraction_method text NOT NULL,
  extraction_confidence numeric(5,4),
  review_status text NOT NULL
    CHECK (review_status IN ('safe','quarantined')),
  reason_codes text[] NOT NULL DEFAULT '{}',
  reviewed_by uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  review_note text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_version_id, revision),
  CHECK (extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1),
  CHECK (
    (review_status='safe' AND text_content IS NOT NULL)
    OR (review_status='quarantined' AND text_content IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_negotiation_extractions_version
  ON negotiation_document_extractions (document_version_id, revision DESC);

CREATE TABLE IF NOT EXISTS negotiation_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  mandate text NOT NULL,
  eligibility text NOT NULL,
  submitting_channel text,
  source_version_id uuid NOT NULL REFERENCES negotiation_document_versions(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('unverified','open','amended','closed','withdrawn')),
  external_deadline_date date,
  external_deadline_time time,
  external_deadline_timezone text,
  external_deadline_precision text NOT NULL
    CHECK (external_deadline_precision IN ('unspecified','date','time')),
  publication_status text NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft','published','retracted')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (external_deadline_precision <> 'time' OR (external_deadline_time IS NOT NULL AND external_deadline_timezone IS NOT NULL)),
  CHECK (external_deadline_precision <> 'date' OR external_deadline_time IS NULL),
  CHECK (publication_status <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS negotiation_track_calls (
  track_id uuid NOT NULL REFERENCES negotiation_tracks(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES negotiation_calls(id) ON DELETE RESTRICT,
  PRIMARY KEY (track_id, call_id)
);

CREATE TABLE IF NOT EXISTS negotiation_follows (
  account_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES negotiation_tracks(id) ON DELETE CASCADE,
  deadline_alerts boolean NOT NULL DEFAULT true,
  substantive_change_alerts boolean NOT NULL DEFAULT true,
  digest_frequency text NOT NULL DEFAULT 'weekly'
    CHECK (digest_frequency IN ('none','daily','weekly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_negotiation_tracks_public
  ON negotiation_tracks (activity_status, topic)
  WHERE publication_status = 'published';
CREATE INDEX IF NOT EXISTS idx_negotiation_agenda_session
  ON negotiation_agenda_items (body, session, item_number);
CREATE INDEX IF NOT EXISTS idx_negotiation_document_versions_document
  ON negotiation_document_versions (document_id, retrieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_negotiation_calls_public_deadline
  ON negotiation_calls (external_deadline_date)
  WHERE publication_status = 'published';
CREATE INDEX IF NOT EXISTS idx_negotiation_follows_account
  ON negotiation_follows (account_id, updated_at DESC);

COMMENT ON TABLE negotiation_document_versions IS
  'Append-only immutable source versions. Same-URL replacements create new rows.';
COMMENT ON TABLE negotiation_follows IS
  'Private account-scoped preferences; follower identities and counts are never public.';
