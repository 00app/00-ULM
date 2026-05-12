-- Rename legacy invoke snapshot column (OpenClaw-era name) → neutral Hermes / pulse name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'research_results'
      AND column_name = 'openclaw_raw_json'
  ) THEN
    ALTER TABLE research_results RENAME COLUMN openclaw_raw_json TO research_snapshot;
  END IF;
END $$;

COMMENT ON COLUMN research_results.research_snapshot IS 'Last research invoke metadata JSON (Hermes / ZeroResearch QA, not user-visible prose).';
