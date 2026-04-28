CREATE TABLE IF NOT EXISTS ai_usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  surface TEXT NOT NULL,
  operation TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  request_count INTEGER,
  estimated_cost_usd NUMERIC(12, 8),
  error_code TEXT,
  error_message TEXT,
  chat_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at
ON ai_usage_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_created_at
ON ai_usage_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_provider_model_created_at
ON ai_usage_events (provider, model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_surface_operation_created_at
ON ai_usage_events (surface, operation, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_events_chat_message_unique
ON ai_usage_events (chat_message_id)
WHERE chat_message_id IS NOT NULL;

INSERT INTO ai_usage_events (
  user_id,
  surface,
  operation,
  success,
  provider,
  model,
  input_tokens,
  output_tokens,
  total_tokens,
  request_count,
  estimated_cost_usd,
  chat_message_id,
  created_at
)
SELECT
  cm.user_id,
  'chat',
  'reply',
  TRUE,
  cm.provider,
  cm.model,
  cm.input_tokens,
  cm.output_tokens,
  cm.total_tokens,
  COALESCE(cm.request_count, 1),
  cm.estimated_cost_usd,
  cm.id,
  cm.created_at
FROM chat_messages cm
WHERE cm.role = 'assistant'
  AND cm.provider IS NOT NULL
  AND cm.provider <> 'local'
ON CONFLICT DO NOTHING;
