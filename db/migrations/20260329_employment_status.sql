-- Employment genome: master switch for lifestyle-architect logic (buildUserImpact).
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_genome JSONB DEFAULT '{}'::jsonb;
