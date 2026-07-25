-- Web push subscriptions.
--
-- Previously held in a module-level Map, which meant every deploy or restart
-- silently dropped every subscription and members stopped receiving anything
-- with no error surfaced anywhere.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (account_id, endpoint)
);

-- Early versions of the schema already used this table name for subscriptions
-- tied to the old `users` table. Upgrade those rows before removing the old
-- columns so this migration also works on an existing installation.
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES hub_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'push_subscriptions'
      AND column_name = 'user_id'
  ) THEN
    UPDATE push_subscriptions AS subscription
    SET account_id = account.id
    FROM users AS legacy_user
    JOIN hub_accounts AS account
      ON lower(account.email) = lower(legacy_user.email)
    WHERE subscription.user_id = legacy_user.id
      AND subscription.account_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'push_subscriptions'
      AND column_name = 'p256dh'
  ) THEN
    UPDATE push_subscriptions
    SET keys = jsonb_build_object('p256dh', p256dh, 'auth', auth)
    WHERE keys = '{}'::jsonb;
  END IF;
END
$$;

-- A legacy subscription with no matching Hub account cannot be used by the new
-- API. The browser can subscribe again after its member signs in.
DELETE FROM push_subscriptions WHERE account_id IS NULL;

ALTER TABLE push_subscriptions
  ALTER COLUMN account_id SET NOT NULL,
  DROP COLUMN IF EXISTS user_id,
  DROP COLUMN IF EXISTS p256dh,
  DROP COLUMN IF EXISTS auth,
  DROP COLUMN IF EXISTS categories;

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_account_endpoint
  ON push_subscriptions (account_id, endpoint);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_account
  ON push_subscriptions (account_id);

-- ON DELETE CASCADE matters for the Privacy Notice: deleting a member's account
-- must take their push endpoints with it, not leave them addressable.
COMMENT ON TABLE push_subscriptions IS
  'Browser push endpoints per member. Deleted with the account (see privacy notice retention).';
