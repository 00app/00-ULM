-- ============================================================
-- ZERO ZERO — NEON DATABASE (SINGLE PASTE FOR CONSOLE.NEON.TECH)
-- Run this in Neon SQL Editor or via: npm run init-db (requires DATABASE_URL)
--
-- LINKING NEON:
-- 1. Create a project at https://console.neon.tech
-- 2. Copy the connection string (Connection details → connection string, e.g. postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require)
-- 3. In project root: set DATABASE_URL in .env.local (and in Vercel → Settings → Environment Variables for production)
-- 4. Apply schema: npm run init-db
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- USERS (profile-only and email/password auth)
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT,
  postcode TEXT,
  household TEXT,
  home_type TEXT,
  transport_baseline TEXT,
  age_group TEXT,
  employment_status TEXT,
  user_genome JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Add auth columns to users if table already existed from an older schema (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_genome JSONB DEFAULT '{}'::jsonb;

-- =========================
-- SESSIONS (auth: login/signup and profile-only session cookie)
-- =========================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

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
-- LIKES (card_id TEXT for journey/tip ids e.g. journey-home)
-- =========================
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

-- =========================
-- USER ACTIONED CARDS (Truth vs Potential — Spec v1.4)
-- =========================
CREATE TABLE IF NOT EXISTS user_actioned_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_user_actioned_cards_user_id ON user_actioned_cards(user_id);

-- =========================
-- JOURNEY ANSWERS JSONB (Infinite Loop)
-- =========================
CREATE TABLE IF NOT EXISTS journey_answers_jsonb (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journey_id TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, journey_id)
);
CREATE INDEX IF NOT EXISTS idx_journey_answers_jsonb_user_id ON journey_answers_jsonb(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_answers_jsonb_user_updated ON journey_answers_jsonb (user_id, updated_at DESC);

-- =========================
-- GUEST SESSIONS (session/IP for returning users)
-- =========================
CREATE TABLE IF NOT EXISTS guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  ip_hash TEXT,
  profile JSONB DEFAULT '{}',
  journey_answers JSONB DEFAULT '{}',
  completed_journeys JSONB DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_session_id ON guest_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_ip_hash ON guest_sessions(ip_hash);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_updated_at ON guest_sessions(updated_at);

-- =========================
-- RESEARCH RESULTS (ZeroResearch / OpenClaw scrape cache)
-- =========================
CREATE TABLE IF NOT EXISTS research_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode TEXT,
  profile_snapshot JSONB DEFAULT '{}',
  markdown TEXT,
  citations JSONB DEFAULT '[]',
  elec_unit_rate_gbp_per_kwh DOUBLE PRECISION,
  gas_unit_rate_gbp_per_kwh DOUBLE PRECISION,
  deep_link TEXT,
  verified_saving DOUBLE PRECISION,
  locality_context TEXT,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_research_results_postcode ON research_results(postcode);
CREATE INDEX IF NOT EXISTS idx_research_results_created_at ON research_results(created_at DESC);

ALTER TABLE research_results ADD COLUMN IF NOT EXISTS provider_name TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS agent_headline TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS openclaw_raw_json JSONB;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS elec_unit_rate_gbp_per_kwh DOUBLE PRECISION;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS gas_unit_rate_gbp_per_kwh DOUBLE PRECISION;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS deep_link TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS verified_saving DOUBLE PRECISION;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS locality_context TEXT;
ALTER TABLE research_results ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Optional question bank — query with WHERE journey_key = $1 only (no cross-category leak).
CREATE TABLE IF NOT EXISTS journey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_key TEXT NOT NULL,
  question_key TEXT NOT NULL,
  prompt_text TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_journey_questions_journey_sort ON journey_questions (journey_key, sort_order ASC, created_at ASC);

-- =========================
-- DISCOVERY INJECTIONS (Card Birth — v1.8.3 audit trail)
-- =========================
CREATE TABLE IF NOT EXISTS discovery_injections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_discovery_injections_user_id ON discovery_injections(user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_injections_created_at ON discovery_injections(created_at DESC);

-- =========================
-- ZAI MESSAGES (Gemini real-time Q&A per session)
-- =========================
CREATE TABLE IF NOT EXISTS zai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'zai')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_zai_messages_session_id ON zai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_zai_messages_created_at ON zai_messages(created_at DESC);

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

-- =========================
-- SCRAPED SUMMARY (001 scraper output for Zone overlay)
-- =========================
CREATE TABLE IF NOT EXISTS scraped_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_key TEXT NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  carbon_value INTEGER NOT NULL,
  money_value INTEGER NOT NULL,
  deep_content_tip TEXT,
  high_saving BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (journey_key)
);
CREATE INDEX IF NOT EXISTS idx_scraped_summary_journey ON scraped_summary(journey_key);
CREATE INDEX IF NOT EXISTS idx_scraped_summary_scraped_at ON scraped_summary(scraped_at);
