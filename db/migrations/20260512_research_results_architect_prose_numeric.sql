-- AI tip line + GBP amounts as numeric(10,2) (London / production Neon).
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS architect_prose TEXT;

-- Normalize saving_amount_gbp to NUMERIC(10,2) whether the column was double precision or already numeric.
ALTER TABLE research_results
  ALTER COLUMN saving_amount_gbp TYPE NUMERIC(10,2)
  USING (
    CASE
      WHEN saving_amount_gbp IS NULL THEN NULL
      ELSE ROUND(saving_amount_gbp::numeric, 2)
    END
  );
