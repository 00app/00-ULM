-- ============================================================
-- ZERO ZERO — NEON DATABASE + SPACE LOGIC (SINGLE PASTE)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  postcode TEXT,
  household TEXT,
  home_type TEXT,
  transport_baseline TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- =========================
-- JOURNEYS
-- =========================
CREATE TABLE IF NOT EXISTS journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  journey_key TEXT NOT NULL,
  state TEXT CHECK (state IN ('not_started','in_progress','completed')) DEFAULT 'not_started',
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, journey_key)
);

-- =========================
-- JOURNEY ANSWERS
-- =========================
CREATE TABLE IF NOT EXISTS journey_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  journey_key TEXT NOT NULL,
  question_key TEXT NOT NULL,
  answer TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, journey_key, question_key)
);

-- =========================
-- CARDS
-- =========================
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_key TEXT,
  type TEXT CHECK (type IN ('cheapest','greenest','balance','tip')),
  title TEXT NOT NULL,
  description TEXT,
  impact_band TEXT CHECK (impact_band IN ('low','medium','high')),
  effort_band TEXT CHECK (effort_band IN ('low','medium','high')),
  created_at TIMESTAMP DEFAULT now()
);

-- =========================
-- CARD VIEWS (FRESHNESS)
-- =========================
CREATE TABLE IF NOT EXISTS card_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  last_shown_at TIMESTAMP,
  shown_count INTEGER DEFAULT 0,
  UNIQUE (user_id, card_id)
);

-- =========================
-- LIKES
-- =========================
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, card_id)
);

-- =========================
-- MICRO ANSWERS
-- =========================
CREATE TABLE IF NOT EXISTS micro_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  question_key TEXT,
  answer TEXT,
  created_at TIMESTAMP DEFAULT now()
);
