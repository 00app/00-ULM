-- Truth vs Potential: cards marked as "Actioned" move their saving from Potential to Truth (Spec v1.4)
CREATE TABLE IF NOT EXISTS user_actioned_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_user_actioned_cards_user_id ON user_actioned_cards(user_id);
