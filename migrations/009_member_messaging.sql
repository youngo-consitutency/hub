-- Direct member messaging, constrained in application code to contact points / mandate holders.
CREATE TABLE IF NOT EXISTS message_conversations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a        uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  participant_b        uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  created_by           uuid REFERENCES hub_accounts(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  last_message_at      timestamptz,
  last_message_preview text,
  CHECK (participant_a <> participant_b),
  UNIQUE (participant_a, participant_b)
);

CREATE INDEX IF NOT EXISTS idx_message_conversations_a ON message_conversations (participant_a, (COALESCE(last_message_at, updated_at)) DESC);
CREATE INDEX IF NOT EXISTS idx_message_conversations_b ON message_conversations (participant_b, (COALESCE(last_message_at, updated_at)) DESC);

CREATE TABLE IF NOT EXISTS messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  sender_account_id uuid NOT NULL REFERENCES hub_accounts(id) ON DELETE CASCADE,
  body              text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at ASC);
