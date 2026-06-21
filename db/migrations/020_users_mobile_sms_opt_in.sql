-- SMS opt-in for Rock mobile signup (STOP/START via /api/webhooks/twilio).
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_sms_opt_in BOOLEAN NOT NULL DEFAULT false;
