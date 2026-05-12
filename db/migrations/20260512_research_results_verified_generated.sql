-- Single boolean on `research_results` for Zone / Solo Focus "✓ True data" (Neon source of truth).
-- Mirrors positive savings on the latest row; kept generated so it stays aligned with verified_saving / saving_amount_gbp.
ALTER TABLE research_results
  ADD COLUMN IF NOT EXISTS verified BOOLEAN
  GENERATED ALWAYS AS (
    (COALESCE(verified_saving, 0::double precision) > 0)
    OR (COALESCE(saving_amount_gbp, 0::numeric) > 0)
  ) STORED;
