ALTER TABLE chat_conversations
ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_pinned_updated
ON chat_conversations (user_id, pinned DESC, updated_at DESC, id DESC);
