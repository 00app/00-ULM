-- SSO activity visibility and delete: per-user per-activity status (Spec)
CREATE TABLE IF NOT EXISTS activity_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'chronicle_hidden', 'deleted')),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_status_user_id ON activity_status(user_id);
