-- Infinite morph genome: attribution + OpenClaw debug payload; fast JSONB upserts; optional DB-backed question catalog.
-- Apply in Neon SQL editor or via your migration runner.

ALTER TABLE research_results ADD COLUMN IF NOT EXISTS provider_name TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS agent_headline TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS openclaw_raw_json JSONB;

COMMENT ON COLUMN research_results.provider_name IS 'Supplied-by attribution (e.g. Ofgem, GOV.UK) for Zone / Solo Focus.';
COMMENT ON COLUMN research_results.agent_headline IS 'Short headline from ZeroResearch / NextWin for card title override.';
COMMENT ON COLUMN research_results.openclaw_raw_json IS 'Last invoke response snapshot for QA / Pulse widget.';

-- High-velocity reads: latest answers per user (pulse, dashboards)
CREATE INDEX IF NOT EXISTS idx_journey_answers_jsonb_user_updated
  ON journey_answers_jsonb (user_id, updated_at DESC);

-- Unlimited rows per journey_key — always filter WHERE journey_key = $1 (never cross-category).
CREATE TABLE IF NOT EXISTS journey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_key TEXT NOT NULL,
  question_key TEXT NOT NULL,
  prompt_text TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journey_questions_journey_sort
  ON journey_questions (journey_key, sort_order ASC, created_at ASC);

COMMENT ON TABLE journey_questions IS 'Optional CMS/agent question bank; app code queue remains lib/journeys + getNextQuestion(journeyId) — DB API must filter by journey_key.';
