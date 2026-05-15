-- ============================================================
-- ZERO ZERO — LOCKED NEON DATABASE SCHEMA
-- Production-ready schema for questions, answers, calculations, and cards
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  postcode TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- JOURNEY ANSWERS
-- =========================
CREATE TABLE IF NOT EXISTS journey_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  journey_key TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, journey_key, question_id)
);

-- =========================
-- CALCULATED IMPACT (ZONE FEED)
-- =========================
CREATE TABLE IF NOT EXISTS journey_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  journey_key TEXT NOT NULL,
  carbon_kg INTEGER NOT NULL,
  money_gbp INTEGER NOT NULL,
  source TEXT NOT NULL,
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, journey_key)
);

-- =========================
-- CARDS (REAL CONTENT)
-- =========================
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  carbon_kg INTEGER,
  money_gbp INTEGER,
  source TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- ACTIVITY STATUS (SSO visibility / delete)
-- =========================
CREATE TABLE IF NOT EXISTS activity_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'chronicle_hidden', 'deleted')),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_activity_status_user_id ON activity_status(user_id);

-- =========================
-- INDEXES FOR PERFORMANCE
-- =========================
CREATE INDEX IF NOT EXISTS idx_journey_answers_user_journey ON journey_answers(user_id, journey_key);
CREATE INDEX IF NOT EXISTS idx_journey_impacts_user ON journey_impacts(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_journey ON cards(journey_key);

-- =========================
-- USER PROFILES (Hermes / Solo Focus mirror — JSON snapshot keyed by users.id)
-- =========================
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  journey_answers_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles (updated_at DESC);
