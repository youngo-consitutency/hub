-- Operational records are durable and never generated from relative demo dates.
ALTER TABLE account_assignments DROP CONSTRAINT IF EXISTS account_assignments_scope_type_check;
ALTER TABLE account_assignments ADD CONSTRAINT account_assignments_scope_type_check
  CHECK (scope_type IN ('platform','team','working_group','organization','body'));
ALTER TABLE account_assignments ADD COLUMN IF NOT EXISTS appointment_evidence text NOT NULL DEFAULT '';

CREATE TABLE platform_bodies (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9-]{1,79}$'),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('working_group','operational_team','coordination','council','task_force')),
  description text NOT NULL DEFAULT '',
  public_summary text NOT NULL DEFAULT '',
  review_due_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES hub_accounts(id),
  public_snapshot jsonb,
  published_version integer,
  published_by uuid REFERENCES hub_accounts(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body_id text NOT NULL REFERENCES platform_bodies(id),
  title text NOT NULL,
  proposal text NOT NULL,
  stage text NOT NULL DEFAULT 'draft' CHECK (stage IN ('draft','consultation','revision','decision','voting','adopted','not_adopted','withdrawn')),
  process text NOT NULL CHECK (process IN ('standard','snap')),
  snap_hours numeric NOT NULL DEFAULT 24 CHECK (snap_hours > 0 AND snap_hours < 168),
  urgency_reason text NOT NULL DEFAULT '',
  policy_version text NOT NULL,
  deadline_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  author_id uuid NOT NULL REFERENCES hub_accounts(id),
  is_public boolean NOT NULL DEFAULT false,
  outcome text,
  outcome_evidence text,
  electorate_size integer,
  votes_for integer,
  votes_against integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_decisions_body ON platform_decisions(body_id,stage);
CREATE TABLE platform_decision_revisions (
  decision_id uuid NOT NULL REFERENCES platform_decisions(id),
  version integer NOT NULL,
  title text NOT NULL,
  proposal text NOT NULL,
  author_id uuid NOT NULL REFERENCES hub_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(decision_id,version)
);
CREATE TABLE platform_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES platform_decisions(id),
  author_id uuid NOT NULL REFERENCES hub_accounts(id),
  kind text NOT NULL CHECK(kind IN ('comment','red','grey')),
  text text NOT NULL,
  grounds text NOT NULL DEFAULT '',
  alternative text NOT NULL DEFAULT '',
  resolution text,
  resolved_by uuid REFERENCES hub_accounts(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body_id text NOT NULL REFERENCES platform_bodies(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_id uuid REFERENCES hub_accounts(id),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','done')),
  decision_id uuid REFERENCES platform_decisions(id),
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES hub_accounts(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_tasks_due ON platform_tasks(due_at) WHERE status <> 'done';
CREATE TABLE platform_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  privacy_version text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','closed','approved')),
  owner_id uuid REFERENCES hub_accounts(id),
  follow_up_at timestamptz,
  decision_id uuid REFERENCES platform_decisions(id),
  public_summary text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- No names, mandates, memberships or policy outcomes are invented during migration.
