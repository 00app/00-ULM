-- Guest visit breadcrumbs (no login) + research_results hygiene indexes.

ALTER TABLE guest_sessions
  ADD COLUMN IF NOT EXISTS visited_card_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS visited_journey_keys JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN guest_sessions.visited_card_ids IS 'Card ids opened this zz_sid session — pink/yellow lock without Gemini re-burn.';
COMMENT ON COLUMN guest_sessions.visited_journey_keys IS 'Journey keys visited (home, travel, …) for scrape-sync visited_journey_keys merge.';

CREATE INDEX IF NOT EXISTS idx_research_results_user_category_created
  ON research_results (user_id, lower(trim(category)), created_at DESC NULLS LAST)
  WHERE category IS NOT NULL AND btrim(category) <> '';

CREATE INDEX IF NOT EXISTS idx_research_results_postcode_category_created
  ON research_results (replace(COALESCE(postcode, ''), ' ', ''), lower(trim(category)), created_at DESC NULLS LAST)
  WHERE category IS NOT NULL AND btrim(category) <> '';
