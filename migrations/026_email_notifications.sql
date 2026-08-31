-- Governed email notifications: verified addresses, explicit preferences,
-- idempotent outbox delivery, operational attempts, and suppressions.

ALTER TABLE hub_accounts
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verification_account
  ON email_verification_tokens (account_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS notification_settings (
  account_id       uuid PRIMARY KEY REFERENCES hub_accounts(id) ON DELETE CASCADE,
  timezone         text NOT NULL DEFAULT 'UTC',
  digest_day       smallint NOT NULL DEFAULT 1 CHECK (digest_day BETWEEN 0 AND 6),
  digest_hour_utc  smallint NOT NULL DEFAULT 6 CHECK (digest_hour_utc BETWEEN 0 AND 23),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  account_id  uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  channel     text NOT NULL CHECK (channel IN ('email','push')),
  category    text NOT NULL CHECK (category IN ('digest','deadline','announcement')),
  enabled     boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, channel, category)
);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_enabled
  ON notification_preferences (channel, category, account_id)
  WHERE enabled = true;

CREATE TABLE IF NOT EXISTS notification_outbox (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  category              text NOT NULL CHECK (category IN ('digest','deadline','announcement')),
  template_key          text NOT NULL,
  source_type           text,
  source_id             text,
  deduplication_key     text NOT NULL UNIQUE,
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                text NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued','sending','sent','retry','failed','suppressed','cancelled')),
  attempts              integer NOT NULL DEFAULT 0,
  available_at          timestamptz NOT NULL DEFAULT now(),
  lease_until           timestamptz,
  provider_message_id   text,
  last_error_code       text,
  last_error_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  sent_at               timestamptz
);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_due
  ON notification_outbox (available_at, created_at)
  WHERE status IN ('queued','retry');
CREATE INDEX IF NOT EXISTS idx_notification_outbox_account_sent
  ON notification_outbox (account_id, sent_at DESC)
  WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_notification_outbox_account_active
  ON notification_outbox (account_id, available_at, created_at)
  WHERE status IN ('queued','retry','sending');

CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
  id                   bigserial PRIMARY KEY,
  outbox_id            uuid NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
  attempt_number       integer NOT NULL,
  outcome              text NOT NULL CHECK (outcome IN ('accepted','deferred','rejected','suppressed')),
  provider_message_id  text,
  response_code        text,
  attempted_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outbox_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS email_suppressions (
  account_id         uuid PRIMARY KEY REFERENCES hub_accounts(id) ON DELETE CASCADE,
  address_hash       text NOT NULL,
  reason             text NOT NULL CHECK (reason IN ('hard_bounce','complaint','manual')),
  provider_event_id  text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_hash
  ON email_suppressions (address_hash);

COMMENT ON TABLE notification_outbox IS
  'Account-addressed notification intents. Recipient addresses and rendered bodies are resolved at delivery and are never stored here.';
COMMENT ON COLUMN notification_outbox.payload IS
  'Allowlisted template values and public/source identifiers only; no credentials or account-profile records.';
COMMENT ON TABLE notification_delivery_attempts IS
  'Operational outcomes without recipient email addresses or message bodies.';
