-- Zero Zero: knowledge gathering fields (4 Nov 2026). Builds on 20261025_intelligence_layer.sql.
-- Idempotent and additive: safe to run twice, rewrites no existing data.
--
-- Solo Focus and agents now ask questions that fill household_facts. knowledge_questions logs each
-- ask; these columns let a new device replay the answer (answer_value), group by journey, and tell
-- which surface asked (source). The fact itself still lives in household_facts.

ALTER TABLE knowledge_questions ADD COLUMN IF NOT EXISTS journey_id   TEXT;
ALTER TABLE knowledge_questions ADD COLUMN IF NOT EXISTS answer_value TEXT;   -- stored token, e.g. 'BELOW_BASE'; NULL when skipped / not sure
ALTER TABLE knowledge_questions ADD COLUMN IF NOT EXISTS source       TEXT
  CHECK (source IS NULL OR source IN ('solo_focus','loop','agent','zai'));

CREATE INDEX IF NOT EXISTS knowledge_questions_user_status_idx
  ON knowledge_questions (user_id, status, resolved_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_questions_guest_status_idx
  ON knowledge_questions (guest_session_id, status, resolved_at DESC) WHERE guest_session_id IS NOT NULL;
