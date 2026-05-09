ALTER TABLE research_results ADD COLUMN IF NOT EXISTS elec_unit_rate_gbp_per_kwh DOUBLE PRECISION;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS gas_unit_rate_gbp_per_kwh DOUBLE PRECISION;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS deep_link TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS verified_saving DOUBLE PRECISION;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS locality_context TEXT;
