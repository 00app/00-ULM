-- Drop tables with zero application writes (see scripts/audit-neon-tables.ts).
-- Run in Neon SQL Editor AFTER confirming row counts are 0 (or data is disposable).
-- Does NOT drop journey_answers (normalized dual-write + discovery FK) or cards (harmless if empty).

DROP TABLE IF EXISTS card_views CASCADE;
DROP TABLE IF EXISTS micro_answers CASCADE;
DROP TABLE IF EXISTS zai_messages CASCADE;
