-- Messaging was removed from the Hub. Keep migration 009 immutable for
-- installations that already applied it, then remove its tables forward-only.
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS message_conversations;
