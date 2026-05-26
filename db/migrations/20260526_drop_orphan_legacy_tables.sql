-- Orphan tables with zero app references (audit 2026-05-26). Safe when row count = 0.

DROP TABLE IF EXISTS zone_questions CASCADE;
DROP TABLE IF EXISTS user_answers CASCADE;
DROP TABLE IF EXISTS user_likes CASCADE;
