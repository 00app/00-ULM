-- Pattern-shift loop (close Solo Focus) — link injections to journey + question + answer
ALTER TABLE discovery_injections
  ADD COLUMN IF NOT EXISTS journey_key TEXT,
  ADD COLUMN IF NOT EXISTS question_id TEXT,
  ADD COLUMN IF NOT EXISTS answer_value TEXT;

CREATE INDEX IF NOT EXISTS idx_discovery_injections_user_journey
  ON discovery_injections (user_id, journey_key);

CREATE INDEX IF NOT EXISTS idx_discovery_injections_question
  ON discovery_injections (user_id, question_id);
