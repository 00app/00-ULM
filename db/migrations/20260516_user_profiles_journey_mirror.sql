-- =============================================================================
-- user_profiles — Hermes / auditor mirror (20260516)
-- =============================================================================
-- Canonical journey storage remains `journey_answers_jsonb` + `users.user_genome`.
-- This table is an optional JSON snapshot keyed by `users.id` so
-- `loadDynamicUserProfileForResearch` and Solo Focus audit-complete can merge
-- the same payload without forking onboarding data.
--
-- Safe on empty DBs: CREATE IF NOT EXISTS. If you already had a incompatible
-- `user_profiles`, resolve manually before applying — this file does not alter
-- existing table definitions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  journey_answers_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles (updated_at DESC);

COMMENT ON TABLE user_profiles IS 'Mirror of embedded journey answers (JSON); keyed by users.id. Solo Focus audit-complete UPSERT.';
COMMENT ON COLUMN user_profiles.journey_answers_jsonb IS 'Per-journey answers map aligned with lib/journeys JOURNEY_ORDER keys.';
