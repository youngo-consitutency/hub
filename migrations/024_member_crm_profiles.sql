-- Member-controlled CRM profiles. Identity and operational relationships stay in
-- hub_accounts/account_assignments/WG progress/NGO seats; this table contains
-- only fields a member has chosen to share with other verified members.
CREATE TABLE IF NOT EXISTS member_profiles (
  account_id            uuid PRIMARY KEY REFERENCES hub_accounts(id) ON DELETE CASCADE,
  display_name          text,
  headline              text,
  bio                   text,
  pronouns               text,
  expertise_tags        text[] NOT NULL DEFAULT '{}',
  directory_visibility  text NOT NULL DEFAULT 'private'
    CHECK (directory_visibility IN ('private', 'members')),
  show_country          boolean NOT NULL DEFAULT false,
  show_organization     boolean NOT NULL DEFAULT false,
  show_working_groups   boolean NOT NULL DEFAULT true,
  show_roles            boolean NOT NULL DEFAULT true,
  revision              integer NOT NULL DEFAULT 1,
  updated_by            uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_profiles_directory
  ON member_profiles (directory_visibility, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_profiles_tags
  ON member_profiles USING gin (expertise_tags);

-- Binary media is isolated from the profile row so it can be migrated to
-- object storage later without changing profile or directory contracts.
CREATE TABLE IF NOT EXISTS member_profile_photos (
  account_id   uuid PRIMARY KEY REFERENCES hub_accounts(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes        bytea NOT NULL,
  byte_size    integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 786432),
  revision     integer NOT NULL DEFAULT 1,
  updated_by   uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
