-- v1.8.3 — Card Birth audit trail (Living Discovery Engine)
CREATE TABLE IF NOT EXISTS discovery_injections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_discovery_injections_user_id ON discovery_injections(user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_injections_created_at ON discovery_injections(created_at DESC);
