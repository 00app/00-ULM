-- Lifestyle Architect V8 — achievement cards + pattern-shift loop metadata
ALTER TABLE discovery_injections
  ADD COLUMN IF NOT EXISTS is_achievement_card BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_answer_id UUID REFERENCES journey_answers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lifestyle_mode TEXT;

CREATE INDEX IF NOT EXISTS idx_discovery_injections_achievement
  ON discovery_injections (user_id, is_achievement_card)
  WHERE is_achievement_card = true;
