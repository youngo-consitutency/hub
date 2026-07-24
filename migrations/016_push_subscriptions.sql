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

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_account
  ON push_subscriptions (account_id);

-- ON DELETE CASCADE matters for the Privacy Notice: deleting a member's account
-- must take their push endpoints with it, not leave them addressable.
COMMENT ON TABLE push_subscriptions IS
  'Browser push endpoints per member. Deleted with the account (see privacy notice retention).';
