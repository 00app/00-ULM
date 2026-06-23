-- Solo Focus offer feedback: like / dislike / indifferent / ask
CREATE TABLE IF NOT EXISTS offer_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_session_id TEXT,
  card_id TEXT NOT NULL,
  signal TEXT NOT NULL CHECK (signal IN ('like', 'dislike', 'indifferent', 'ask')),
  journey_key TEXT,
  card_title TEXT,
  money_gbp INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS offer_signals_user_created_idx
  ON offer_signals (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS offer_signals_guest_created_idx
  ON offer_signals (guest_session_id, created_at DESC)
  WHERE guest_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS offer_signals_card_signal_idx
  ON offer_signals (user_id, card_id, signal);
