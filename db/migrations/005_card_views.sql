CREATE TABLE card_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  last_shown_at TIMESTAMP,
  shown_count INTEGER DEFAULT 0,
  UNIQUE (user_id, card_id)
);
