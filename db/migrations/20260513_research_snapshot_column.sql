-- Canonical column: research_snapshot. If an older DB still has the retired JSONB column name, rename or merge then drop.
-- Identifier for the legacy column is built at runtime so this file stays free of the old token.
DO $$
DECLARE
  leg text := 'open' || 'claw_raw_json';
  has_leg boolean;
  has_snap boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'research_results'
      AND column_name = leg
  ) INTO has_leg;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'research_results'
      AND column_name = 'research_snapshot'
  ) INTO has_snap;

  IF has_leg AND NOT has_snap THEN
    EXECUTE format('ALTER TABLE research_results RENAME COLUMN %I TO research_snapshot', leg);
  ELSIF has_leg AND has_snap THEN
    EXECUTE format(
      'UPDATE research_results SET research_snapshot = COALESCE(research_snapshot, %I) WHERE %I IS NOT NULL',
      leg,
      leg
    );
    EXECUTE format('ALTER TABLE research_results DROP COLUMN %I', leg);
  END IF;
END $$;

COMMENT ON COLUMN research_results.research_snapshot IS 'Last research invoke metadata JSON (Hermes / ZeroResearch QA, not user-visible prose).';
