-- YOUNGO Hub schema v1 — from docs/specs/youngo/04-api-data-spec.md §2
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  name          text,
  country       text,
  timezone      text NOT NULL DEFAULT 'UTC',
  locale        text NOT NULL DEFAULT 'en',
  role          text NOT NULL DEFAULT 'member'
                CHECK (role IN ('member','wg_admin','focal_point')),
  digest_day    smallint DEFAULT 1 CHECK (digest_day BETWEEN 0 AND 6),
  digest_optin  boolean NOT NULL DEFAULT true,
  alerts_optin  boolean NOT NULL DEFAULT true,
  ics_token     uuid UNIQUE DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz
);

CREATE TABLE magic_link_tokens (
  token       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       citext NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
CREATE INDEX idx_magic_email ON magic_link_tokens(email, expires_at);

CREATE TABLE working_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  focus_line    text NOT NULL,
  description   text,
  monogram      text,
  color         text,
  whatsapp_url  text,
  group_url     text,
  drive_url     text,
  contact_email text,
  cadence_note  text,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 100,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wg_admins (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  wg_id   uuid REFERENCES working_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, wg_id)
);

CREATE TABLE wg_follows (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  wg_id   uuid REFERENCES working_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, wg_id)
);

CREATE TABLE unfccc_sessions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code      text UNIQUE NOT NULL,
  name      text NOT NULL,
  city      text, venue text,
  timezone  text NOT NULL,
  starts_on date NOT NULL, ends_on date NOT NULL
);

CREATE TABLE events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  title        text NOT NULL,
  type         text NOT NULL CHECK (type IN
               ('constituency_call','wg_call','wgf','unfccc_session','webinar','coordination')),
  description  text,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz,
  rrule        text,
  exdates      timestamptz[] NOT NULL DEFAULT '{}',
  meeting_url  text,
  recording_url text,
  location     text, room text,
  session_id   uuid REFERENCES unfccc_sessions(id),
  wg_id        uuid REFERENCES working_groups(id),
  created_by   uuid REFERENCES users(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_start ON events(starts_at);
CREATE INDEX idx_events_wg ON events(wg_id);

CREATE TABLE submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  title         text NOT NULL,
  unfccc_url    text,
  deadline_at   timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN
                ('open','drafting','internal_review','submitted','archived')),
  draft_url     text,
  final_url     text,
  contribute_note text,
  wg_id         uuid REFERENCES working_groups(id),
  submitted_at  timestamptz,
  created_by    uuid REFERENCES users(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_submissions_deadline ON submissions(deadline_at)
  WHERE status IN ('open','drafting','internal_review');

CREATE TABLE dmp_decisions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  title        text NOT NULL,
  summary      text,
  proposal_url text,
  final_url    text,
  status       text NOT NULL DEFAULT 'proposed' CHECK (status IN
               ('proposed','open_for_input','objection_window',
                'adopted','not_adopted','withdrawn')),
  input_deadline     timestamptz,
  objection_deadline timestamptz,
  respond_note text,
  wg_id        uuid REFERENCES working_groups(id),
  discussion_event_id uuid REFERENCES events(id),
  decided_at   timestamptz,
  outcome_note text,
  created_by   uuid REFERENCES users(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dmp_active ON dmp_decisions(objection_deadline)
  WHERE status IN ('open_for_input','objection_window');

CREATE TABLE dmp_status_log (
  id          bigserial PRIMARY KEY,
  decision_id uuid REFERENCES dmp_decisions(id) ON DELETE CASCADE,
  status      text NOT NULL,
  note        text,
  at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE coys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  type         text NOT NULL CHECK (type IN ('lcoy','rcoy','coy')),
  title        text NOT NULL,
  country      text, city text,
  region       text CHECK (region IN
               ('africa','apac','eca','lac','mena','noram','weog')),
  starts_on    date, ends_on date,
  dates_tbc    boolean NOT NULL DEFAULT false,
  status       text NOT NULL DEFAULT 'announced' CHECK (status IN
               ('announced','applications_open','registration_open','concluded','cancelled')),
  register_url text, website_url text, instagram_url text,
  organizer_name text, organizer_org text, organizer_email text,
  poster_url   text,
  review_status text NOT NULL DEFAULT 'approved' CHECK (review_status IN
               ('pending','approved','rejected')),
  review_note  text,
  reviewed_by  uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coys_public ON coys(starts_on) WHERE review_status = 'approved';

CREATE TABLE announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  wg_id      uuid REFERENCES working_groups(id),
  pinned     boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id),
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ann_feed ON announcements(published_at DESC);

CREATE TABLE contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name  text NOT NULL CHECK (group_name IN
              ('focal_points','wg_contacts','liaisons','operations')),
  role_title  text NOT NULL,
  description text,
  person_name text,
  channel_type text CHECK (channel_type IN ('email','whatsapp','telegram','signal')),
  channel_value text,
  public_email text,
  wg_id       uuid REFERENCES working_groups(id),
  sort_order  int NOT NULL DEFAULT 100,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL, p256dh text NOT NULL, auth text NOT NULL,
  categories text[] NOT NULL DEFAULT '{live,deadlines}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL, entity_id uuid,
  detail jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
