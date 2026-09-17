-- S2 member drafting projects, immutable versions and exact-version amendments.

CREATE TABLE IF NOT EXISTS negotiation_mutation_idempotency (
  actor_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, operation, idempotency_key)
);

CREATE TABLE IF NOT EXISTS negotiation_submission_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_submission_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  track_id uuid NOT NULL REFERENCES negotiation_tracks(id) ON DELETE RESTRICT,
  call_id uuid REFERENCES negotiation_calls(id) ON DELETE RESTRICT,
  title text NOT NULL,
  purpose text NOT NULL,
  working_group_slug text,
  intended_submitting_entity text,
  external_draft_url text,
  is_initiative boolean NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'proposal'
    CHECK (lifecycle_status IN (
      'proposal','triage','drafting','consultation','endorsement_pending',
      'endorsed','ready_for_transmission','transmitted','changes_requested',
      'declined','withdrawn','closed','superseded'
    )),
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','project_team')),
  created_by uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  current_version integer NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (call_id IS NOT NULL OR is_initiative = true),
  CHECK (call_id IS NULL OR is_initiative = false)
);

CREATE TABLE IF NOT EXISTS negotiation_submission_project_members (
  project_id uuid NOT NULL REFERENCES negotiation_submission_projects(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','contributor','viewer')),
  added_by uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, account_id)
);

CREATE TABLE IF NOT EXISTS negotiation_submission_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES negotiation_submission_projects(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  base_version_id uuid REFERENCES negotiation_submission_versions(id) ON DELETE RESTRICT,
  content_text text NOT NULL,
  content_hash text NOT NULL,
  external_snapshot_url text,
  authored_by uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version),
  UNIQUE (project_id, content_hash)
);

CREATE TABLE IF NOT EXISTS negotiation_submission_evidence (
  project_version_id uuid NOT NULL REFERENCES negotiation_submission_versions(id) ON DELETE RESTRICT,
  source_version_id uuid NOT NULL REFERENCES negotiation_document_versions(id) ON DELETE RESTRICT,
  location jsonb NOT NULL,
  quote text,
  PRIMARY KEY (project_version_id, source_version_id, location)
);

CREATE TABLE IF NOT EXISTS negotiation_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES negotiation_submission_projects(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('official_document','internal_draft')),
  target_document_version_id uuid REFERENCES negotiation_document_versions(id) ON DELETE RESTRICT,
  target_project_version_id uuid REFERENCES negotiation_submission_versions(id) ON DELETE RESTRICT,
  stable_anchor jsonb NOT NULL,
  operation text NOT NULL CHECK (operation IN ('insert','replace','delete')),
  original_text text NOT NULL,
  proposed_text text,
  rationale text NOT NULL,
  decision_status text NOT NULL DEFAULT 'draft'
    CHECK (decision_status IN (
      'draft','proposed','discussion','accepted_into_draft',
      'changes_requested','declined','withdrawn'
    )),
  reconciliation_status text NOT NULL DEFAULT 'anchored'
    CHECK (reconciliation_status IN ('anchored','mapping_suggested','needs_reconciliation','confirmed')),
  author_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (target_type='official_document' AND target_document_version_id IS NOT NULL AND target_project_version_id IS NULL)
    OR
    (target_type='internal_draft' AND target_project_version_id IS NOT NULL AND target_document_version_id IS NULL)
  ),
  CHECK (operation <> 'delete' OR proposed_text IS NULL),
  CHECK (operation = 'delete' OR proposed_text IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS negotiation_amendment_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id uuid NOT NULL REFERENCES negotiation_amendments(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  content_hash text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('insert','replace','delete')),
  original_text text NOT NULL,
  proposed_text text,
  rationale text NOT NULL,
  stable_anchor jsonb NOT NULL,
  authored_by uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (amendment_id, version)
);

CREATE TABLE IF NOT EXISTS negotiation_amendment_evidence (
  amendment_version_id uuid NOT NULL REFERENCES negotiation_amendment_versions(id) ON DELETE RESTRICT,
  source_version_id uuid NOT NULL REFERENCES negotiation_document_versions(id) ON DELETE RESTRICT,
  location jsonb NOT NULL,
  quote text,
  PRIMARY KEY (amendment_version_id, source_version_id, location)
);

CREATE TABLE IF NOT EXISTS negotiation_amendment_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id uuid NOT NULL REFERENCES negotiation_amendments(id) ON DELETE RESTRICT,
  from_document_version_id uuid NOT NULL REFERENCES negotiation_document_versions(id) ON DELETE RESTRICT,
  suggested_document_version_id uuid NOT NULL REFERENCES negotiation_document_versions(id) ON DELETE RESTRICT,
  suggested_anchor jsonb NOT NULL,
  mapping_evidence jsonb NOT NULL,
  confidence numeric(5,4),
  status text NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested','confirmed','rejected')),
  confirmed_by uuid REFERENCES hub_accounts(id) ON DELETE RESTRICT,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  CHECK (status <> 'confirmed' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_negotiation_projects_owner
  ON negotiation_submission_projects (created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_negotiation_projects_track
  ON negotiation_submission_projects (track_id, lifecycle_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_negotiation_versions_project
  ON negotiation_submission_versions (project_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_negotiation_amendments_project
  ON negotiation_amendments (project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_negotiation_amendments_document_target
  ON negotiation_amendments (target_document_version_id)
  WHERE target_type='official_document';

COMMENT ON TABLE negotiation_submission_versions IS
  'Append-only review snapshots. Concurrent writers must match the project current_version.';
COMMENT ON TABLE negotiation_amendments IS
  'Member wording proposals only; official source document versions are immutable.';
