-- Session / IP-based storage for returning users (no login).
-- When pushed live, local data is reset; state is restored from this table keyed by session_id or ip_hash.

CREATE TABLE IF NOT EXISTS guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  ip_hash TEXT,
  profile JSONB DEFAULT '{}',
  journey_answers JSONB DEFAULT '{}',
  completed_journeys JSONB DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_session_id ON guest_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_ip_hash ON guest_sessions(ip_hash);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_updated_at ON guest_sessions(updated_at);
