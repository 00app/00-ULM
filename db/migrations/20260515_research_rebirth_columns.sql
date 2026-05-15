-- Rebirth engine: high-impact Solo Focus discoveries persisted on research_results
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS is_high_impact BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS carbon_impact_kg NUMERIC(12, 2);

COMMENT ON COLUMN research_results.is_high_impact IS 'True when Action Vault rebirth (Firecrawl + pro Gemini) produced this row.';
COMMENT ON COLUMN research_results.carbon_impact_kg IS 'Modelled kg CO2e avoided for this rebirth row (12k/1t profile grounding).';
