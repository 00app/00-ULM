-- Live unit rates + canonical source URL for Solo Focus CLAIM / calculators
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS elec_unit_rate_gbp_per_kwh DOUBLE PRECISION;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS gas_unit_rate_gbp_per_kwh DOUBLE PRECISION;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS source_url TEXT;
