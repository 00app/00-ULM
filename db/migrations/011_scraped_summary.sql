-- S UPDATE: scraped_summary — 001 Scraper output for UserImpact overlay
-- Populated by scraper-worker every 24h; read by /api/zone or buildUserImpact when serving Zone.

CREATE TABLE IF NOT EXISTS scraped_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_key TEXT NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  carbon_value INTEGER NOT NULL,
  money_value INTEGER NOT NULL,
  deep_content_tip TEXT,
  high_saving BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (journey_key)
);

CREATE INDEX IF NOT EXISTS idx_scraped_summary_journey ON scraped_summary(journey_key);
CREATE INDEX IF NOT EXISTS idx_scraped_summary_scraped_at ON scraped_summary(scraped_at);

COMMENT ON TABLE scraped_summary IS '001 Scraper output: UK regulatory/industrial data per journey. Validated ≤20% delta; injected into Zone via buildUserImpact options.';
