-- Funnel analytics: /api/analytics has always inserted into analytics_events and
-- /api/admin/funnel + scripts/funnel-report.ts read from it, but no migration ever created the
-- table, so every funnel event was silently dropped (the insert's error is swallowed by design:
-- analytics must never block a page). This creates it with the columns those paths use.
--
-- payload is TEXT, not JSONB: the route stores a JSON string capped at 1,200 characters, and a cut
-- string is not valid JSON. timestamp is the client's event time; received_at is the server's.

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  session_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time ON analytics_events(event_type, timestamp DESC);
