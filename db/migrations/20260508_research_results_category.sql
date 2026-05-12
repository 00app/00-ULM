-- Align with Neon: thematic category for Zone / research rows (Gemini + persist).
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS category TEXT;
