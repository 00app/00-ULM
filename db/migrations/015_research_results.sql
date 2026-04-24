-- Store ZeroResearch agent results (OpenClaw/Firecrawl) for postcode + profile.
-- Used to serve returning users and to avoid re-scraping on every request.

CREATE TABLE IF NOT EXISTS research_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode TEXT,
  profile_snapshot JSONB DEFAULT '{}',
  markdown TEXT,
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_research_results_postcode ON research_results(postcode);
CREATE INDEX IF NOT EXISTS idx_research_results_created_at ON research_results(created_at DESC);
