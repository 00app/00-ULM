-- Infinite Loop: store journey-specific answers as JSONB for flexibility.
-- One row per user per journey; answers = { question_id: value }.
-- GET /api/answers reads from here; POST merges one answer and upserts.
-- Existing journey_answers (normalized) is kept for backward compat; API can dual-write.

CREATE TABLE IF NOT EXISTS journey_answers_jsonb (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journey_id TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, journey_id)
);

CREATE INDEX IF NOT EXISTS idx_journey_answers_jsonb_user_id ON journey_answers_jsonb(user_id);
