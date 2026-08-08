-- Drop tables with zero application writes (see scripts/audit-neon-tables.ts).
-- Run in Neon SQL Editor AFTER confirming row counts are 0 (or data is disposable).
-- Does NOT drop journey_answers (normalized dual-write + discovery FK) or cards (harmless if empty).
-- Does NOT drop zai_messages — unused when this migration was written, but reactivated since
-- (app/zai/page.tsx, lib/zai/chatHistory.ts) and holds real chat history in production as of
-- 2026-08 (confirmed 14 live rows). Dropping it would silently destroy that history.

DROP TABLE IF EXISTS card_views CASCADE;
DROP TABLE IF EXISTS micro_answers CASCADE;
