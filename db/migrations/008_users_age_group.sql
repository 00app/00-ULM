-- Add age_group (persona) for tips: JUNIOR | MID | RETIRED (maps to Junior, Adult, Retired)
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_group TEXT;

-- Optional: extend profile fields for future use (nullable)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
