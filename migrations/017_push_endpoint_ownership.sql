-- A browser push endpoint belongs to the account most recently signed in on
-- that browser. This prevents shared devices from receiving another member's
-- notifications.
DELETE FROM push_subscriptions older
USING push_subscriptions newer
WHERE older.endpoint = newer.endpoint
  AND (
    COALESCE(older.last_used_at, older.created_at) < COALESCE(newer.last_used_at, newer.created_at)
    OR (
      COALESCE(older.last_used_at, older.created_at) = COALESCE(newer.last_used_at, newer.created_at)
      AND older.id < newer.id
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_endpoint
  ON push_subscriptions (endpoint);
