-- =============================================================================
-- Auditor / personalization schema (Neon) — 20260511_init_auditor_schema.sql
-- =============================================================================
--
-- This project already stores onboarding and genome data elsewhere. Do NOT
-- create duplicate tables that would fork the app:
--
--   • "user_profiles"  →  use `public.users` (name, postcode, household,
--     home_type, transport_baseline, age_group, employment_status, user_genome
--     including profile_goal JSON).
--
--   • "journey_answers" (per-question rows)  →  already exists as
--     `public.journey_answers` (user_id → users.id) AND bulk JSON in
--     `public.journey_answers_jsonb` (primary path for the Zone loop).
--
-- This migration only extends `research_results` with explicit auditor-facing
-- column names alongside existing ZeroResearch fields:
--   offer_url          (mirrors / complements deep_link + source_url)
--   saving_amount_gbp  (mirrors verified_saving for SQL clarity)
--
-- user_id on research_results was added in 20260511_research_results_user_id.sql;
-- run that migration first if this is a fresh clone.
-- =============================================================================

ALTER TABLE research_results ADD COLUMN IF NOT EXISTS offer_url TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS saving_amount_gbp DOUBLE PRECISION;

COMMENT ON COLUMN research_results.offer_url IS 'Auditor: canonical offer / action URL; backfilled from deep_link or source_url.';
COMMENT ON COLUMN research_results.saving_amount_gbp IS 'Auditor: headline £ saving; backfilled from verified_saving.';

-- Backfill existing rows so auditors can query one shape.
UPDATE research_results
SET offer_url = COALESCE(
    NULLIF(TRIM(offer_url), ''),
    NULLIF(TRIM(deep_link), ''),
    NULLIF(TRIM(source_url), '')
  )
WHERE offer_url IS NULL;

UPDATE research_results
SET saving_amount_gbp = verified_saving
WHERE saving_amount_gbp IS NULL AND verified_saving IS NOT NULL;
