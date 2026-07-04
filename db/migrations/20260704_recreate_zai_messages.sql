-- Re-adds zai_messages, dropped 2026-05-21 as a zero-write legacy table (see
-- 20260521_drop_legacy_unused_tables.sql). It's now genuinely wired up: app/api/zai/route.ts
-- persists every real exchange (user question + Zai reply) and the /zai page restores the
-- transcript on load via GET /api/zai. session_id holds either the signed-in user's UUID or
-- the guest zz_sid — whichever identity the request carried.

CREATE TABLE IF NOT EXISTS zai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'zai')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_zai_messages_session_id ON zai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_zai_messages_created_at ON zai_messages(created_at DESC);
