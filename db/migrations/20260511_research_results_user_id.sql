-- Link ZeroResearch rows to authenticated users (Hermes/cron + Zone prefer user-scoped truth).
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_research_results_user_created ON research_results (user_id, created_at DESC NULLS LAST)
  WHERE user_id IS NOT NULL;
COMMENT ON COLUMN research_results.user_id IS 'When set, this research run was triggered for this user; prefer over postcode-only rows for personalization.';
