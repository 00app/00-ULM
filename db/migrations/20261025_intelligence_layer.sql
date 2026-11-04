-- Zero Zero PRD v4: intelligence layer schema (Z2 proposal, 25 Oct 2026)
-- Idempotent and additive: safe to run twice, rewrites no existing data.
-- Applied to the dev database 4 Nov 2026 and listed in scripts/apply-pending-migrations.ts.
-- Production waits for the release gate.
--
-- Owner pattern (as offer_signals): a row belongs to a signed-in user (user_id) or a guest
-- (guest_session_id = guest_sessions.session_id). At least one is required. User rows cascade on delete.
-- Money is integer pence. Ranges are low/high. Missing values are NULL, never 0.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. household_facts: everything we know about a household, one row per field
--    Backs the household data service (Z3) and the "What we know" page (Z7).
--    Deleting a fact is a hard DELETE (UK GDPR: the user asked us to forget it).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS household_facts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_session_id TEXT,
  category         TEXT NOT NULL,                 -- journey id incl. 'lifestyle', or 'profile'
  field_key        TEXT NOT NULL,                 -- e.g. 'broadband_contract_end', 'gym_visits_per_month'
  value_jsonb      JSONB NOT NULL,                -- {"value": ..., "unit": "..."}
  source_kind      TEXT NOT NULL CHECK (source_kind IN ('public','told_us','bill','bank','derived','sample')),
  source_name      TEXT NOT NULL,                 -- 'EPC register', 'You told us', 'Ofgem'
  source_url       TEXT,
  as_of            TIMESTAMPTZ NOT NULL,
  confidence       TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  confidence_reason TEXT,
  tier             SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),  -- 1 public, 2 told us, 3 bills or bank
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT household_facts_owner CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS household_facts_user_field_uidx
  ON household_facts (user_id, field_key) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS household_facts_guest_field_uidx
  ON household_facts (guest_session_id, field_key) WHERE user_id IS NULL AND guest_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS household_facts_user_category_idx
  ON household_facts (user_id, category) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS household_facts_guest_category_idx
  ON household_facts (guest_session_id, category) WHERE guest_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. household_accounts: extend bills and contracts (signed-in only, unchanged)
--    Adds lifestyle and insurance categories, tariff detail and provenance.
-- ---------------------------------------------------------------------------
ALTER TABLE household_accounts DROP CONSTRAINT IF EXISTS household_accounts_category_check;
ALTER TABLE household_accounts ADD CONSTRAINT household_accounts_category_check CHECK (category IN (
  'electricity','gas','water','broadband','mobile',
  'council_tax','mortgage','rent','home_insurance',
  'car_insurance','vehicle_tax','subscription','other',
  -- v4 additions
  'streaming','membership','pet_insurance','travel_insurance','savings','energy_fix'
));
ALTER TABLE household_accounts ADD COLUMN IF NOT EXISTS journey_id           TEXT;          -- tech, utilities, lifestyle...
ALTER TABLE household_accounts ADD COLUMN IF NOT EXISTS tariff_name          TEXT;
ALTER TABLE household_accounts ADD COLUMN IF NOT EXISTS is_fixed             BOOLEAN;
ALTER TABLE household_accounts ADD COLUMN IF NOT EXISTS uses_per_month       INTEGER;       -- memberships: visits
ALTER TABLE household_accounts ADD COLUMN IF NOT EXISTS last_price_change_on DATE;
ALTER TABLE household_accounts ADD COLUMN IF NOT EXISTS source_url           TEXT;
ALTER TABLE household_accounts ADD COLUMN IF NOT EXISTS as_of                TIMESTAMPTZ;
ALTER TABLE household_accounts ADD COLUMN IF NOT EXISTS confidence           TEXT
  CHECK (confidence IS NULL OR confidence IN ('high','medium','low'));
CREATE INDEX IF NOT EXISTS idx_household_accounts_contract_end
  ON household_accounts (user_id, contract_end_date) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 3. insight_cards: generated card snapshots (Z4 contract, Z8 ranking)
--    Lets the Zone render fast, and lets us audit what we showed and why.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insight_cards (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_session_id   TEXT,
  card_key           TEXT NOT NULL,               -- stable id, e.g. 'tech:broadband_out_of_contract'
  category           TEXT NOT NULL,
  status_tag         TEXT NOT NULL CHECK (status_tag IN ('live_data','ready','demo','coming_soon')),
  headline           TEXT NOT NULL,
  key_metric_jsonb   JSONB,                       -- {label, value, unit, source, as_of}
  metrics_jsonb      JSONB NOT NULL DEFAULT '[]'::jsonb,
  why_jsonb          JSONB NOT NULL DEFAULT '[]'::jsonb,   -- drivers with data point and source
  saving_kind        TEXT CHECK (saving_kind IN ('typical','estimated','realised','sample')),
  gbp_low_pence      INTEGER,
  gbp_high_pence     INTEGER,
  kg_low             NUMERIC(10,1),
  kg_high            NUMERIC(10,1),
  saving_source_jsonb JSONB,                      -- {name, url, date, method}
  confidence         TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  confidence_reason  TEXT,
  tier               SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
  effort_minutes     INTEGER,
  approval_tier      SMALLINT CHECK (approval_tier BETWEEN 0 AND 3),
  options_jsonb      JSONB NOT NULL DEFAULT '[]'::jsonb,
  gaps_jsonb         JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_jsonb      JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_step_jsonb    JSONB,
  related_card_keys  TEXT[] NOT NULL DEFAULT '{}',
  rank               INTEGER,
  rank_score         NUMERIC(12,4),
  is_hero            BOOLEAN NOT NULL DEFAULT FALSE,
  generated_by       TEXT NOT NULL CHECK (generated_by IN ('rules','ai','fallback')),
  figure_check_passed BOOLEAN NOT NULL DEFAULT TRUE,  -- every number in AI text matched card values
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ,
  CONSTRAINT insight_cards_owner CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL),
  CONSTRAINT insight_cards_gbp_range CHECK (gbp_low_pence IS NULL OR gbp_high_pence IS NULL OR gbp_low_pence <= gbp_high_pence),
  CONSTRAINT insight_cards_kg_range CHECK (kg_low IS NULL OR kg_high IS NULL OR kg_low <= kg_high),
  -- Mechanical truth: no £ without a source
  CONSTRAINT insight_cards_saving_sourced CHECK (
    (gbp_low_pence IS NULL AND gbp_high_pence IS NULL) OR saving_source_jsonb IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS insight_cards_user_rank_idx
  ON insight_cards (user_id, rank) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS insight_cards_guest_rank_idx
  ON insight_cards (guest_session_id, rank) WHERE guest_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS insight_cards_key_idx ON insight_cards (card_key);

-- ---------------------------------------------------------------------------
-- 4. knowledge_questions: what we asked and what happened (Z7)
--    Moves loop-question state server-side; localStorage stays the guest cache.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_session_id TEXT,
  question_id      TEXT NOT NULL,                 -- LOOP_QUESTION_BANK questionId
  card_key         TEXT,
  field_key        TEXT,                          -- household_facts field it fills
  status           TEXT NOT NULL CHECK (status IN ('shown','answered','skipped')),
  value_score      NUMERIC(12,4),                 -- why it was chosen
  shown_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  snooze_until     TIMESTAMPTZ,                   -- skip hides for 30 days
  CONSTRAINT knowledge_questions_owner CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS knowledge_questions_user_idx
  ON knowledge_questions (user_id, question_id, shown_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_questions_guest_idx
  ON knowledge_questions (guest_session_id, question_id, shown_at DESC) WHERE guest_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. tasks: one row per card the user acts on (Z10)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_session_id     TEXT,
  card_key             TEXT NOT NULL,
  action_id            TEXT,                      -- action library id when from the library
  category             TEXT NOT NULL,
  option_key           TEXT,                      -- which of the 2 or 3 options was chosen
  state                TEXT NOT NULL DEFAULT 'new'
                       CHECK (state IN ('new','in_progress','waiting','done','dismissed','snoozed')),
  approval_tier        SMALLINT CHECK (approval_tier BETWEEN 0 AND 3),
  approved_at          TIMESTAMPTZ,
  estimated_gbp_low_pence  INTEGER,
  estimated_gbp_high_pence INTEGER,
  estimated_kg_low     NUMERIC(10,1),
  estimated_kg_high    NUMERIC(10,1),
  estimate_source_jsonb JSONB,
  realised_gbp_pence   INTEGER,                   -- only set from task_evidence
  realised_kg          NUMERIC(10,1),
  realised_evidence_id UUID,
  dismiss_reason       TEXT,
  snoozed_until        TIMESTAMPTZ,
  next_follow_up_at    TIMESTAMPTZ,               -- 30 and 60 day evidence checks
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tasks_owner CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL),
  -- Realised only with evidence
  CONSTRAINT tasks_realised_needs_evidence CHECK (realised_gbp_pence IS NULL OR realised_evidence_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS tasks_user_state_idx ON tasks (user_id, state) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_guest_state_idx ON tasks (guest_session_id, state) WHERE guest_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_follow_up_idx ON tasks (next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. task_events: append-only log for playback (Z11)
--    Replaying this log must rebuild the same totals as tasks.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_events (
  id         BIGSERIAL PRIMARY KEY,
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event      TEXT NOT NULL CHECK (event IN (
               'found','opened','question_answered','option_chosen','approved','action_sent',
               'waiting','confirmed','realised','dismissed','snoozed','follow_up_due','reopened')),
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  source     TEXT,                                -- 'user', 'agent', 'provider', 'system'
  at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_events_task_at_idx ON task_events (task_id, at);

-- ---------------------------------------------------------------------------
-- 7. task_evidence: what turns an estimate into a realised saving (Z11)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_evidence (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('bill_upload','confirmation','user_price','bank_transaction')),
  before_pence   INTEGER,
  after_pence    INTEGER,
  period         TEXT CHECK (period IN ('month','year','one_off')),
  file_ref       TEXT,                            -- storage key, never the file itself
  observed_on    DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_evidence_task_idx ON task_evidence (task_id);
DO $$ BEGIN
  ALTER TABLE tasks ADD CONSTRAINT tasks_realised_evidence_fk
    FOREIGN KEY (realised_evidence_id) REFERENCES task_evidence(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 8. outcome_priors: aggregated learning, no personal data (Z12)
--    Rows under 5 households are never stored.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outcome_priors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         TEXT NOT NULL,
  card_key         TEXT,
  option_key       TEXT,
  region           TEXT,                          -- postcode area or UK nation, never full postcode
  n_households     INTEGER NOT NULL CHECK (n_households >= 5),
  chosen_rate      NUMERIC(5,4),
  completed_rate   NUMERIC(5,4),
  realised_ratio   NUMERIC(6,4),                  -- realised / estimated
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS outcome_priors_key_uidx
  ON outcome_priors (category, COALESCE(card_key,''), COALESCE(option_key,''), COALESCE(region,''));

-- ---------------------------------------------------------------------------
-- 9. Backfill: existing completions become done tasks (typical, nothing realised)
-- ---------------------------------------------------------------------------
INSERT INTO tasks (user_id, card_key, category, state, created_at, updated_at)
SELECT uac.user_id, uac.card_id, 'unknown', 'done', COALESCE(uac.created_at, NOW()), NOW()
FROM user_actioned_cards uac
WHERE NOT EXISTS (
  SELECT 1 FROM tasks t WHERE t.user_id = uac.user_id AND t.card_key = uac.card_id
);
