-- Ulm build: employment / income / goal genome + pink-card visit timestamp on research rows.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS household_income_bracket VARCHAR(50),
  ADD COLUMN IF NOT EXISTS primary_goal VARCHAR(20) DEFAULT 'both';

COMMENT ON COLUMN user_profiles.employment_status IS 'employed | self-employed | unemployed | retired — mirrors users.employment_status for Hermes.';
COMMENT ON COLUMN user_profiles.household_income_bracket IS '<31k | 31k-50k | 50k+ — grant eligibility signal for Zai auditor.';
COMMENT ON COLUMN user_profiles.primary_goal IS 'save | reduce | both — bento sort bias (maps to profile_goal money/carbon/balanced).';

ALTER TABLE research_results
  ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMPTZ;

COMMENT ON COLUMN research_results.last_visited_at IS 'External handoff / deep-dive visit — pink breadcrumb state.';

CREATE INDEX IF NOT EXISTS idx_research_results_last_visited
  ON research_results (user_id, last_visited_at DESC NULLS LAST)
  WHERE user_id IS NOT NULL;
