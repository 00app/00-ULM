-- Household living data model: the bills and contracts a signed-in user keeps on file
-- (household_accounts) and house moves with their change-of-address checklist
-- (household_moves). Settings → Living reads per-group counts from household_accounts; the
-- /settings/living/* pages that write to both tables come in a later pass.
--
-- Both tables require a real users.id. Unlike zai_messages there is deliberately no guest
-- session_id support: this is financial and personal data, so it only exists for an account
-- that can be signed into, and ON DELETE CASCADE removes it with the account.

CREATE TABLE IF NOT EXISTS household_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'electricity','gas','water','broadband','mobile',
    'council_tax','mortgage','rent','home_insurance',
    'car_insurance','vehicle_tax','subscription','other'
  )),
  provider_name TEXT,
  nickname TEXT,
  monthly_amount_pence INTEGER,
  renewal_date DATE,
  contract_end_date DATE,
  postcode TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','bank')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_household_accounts_user ON household_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_household_accounts_category ON household_accounts(user_id, category);

CREATE TABLE IF NOT EXISTS household_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_postcode TEXT,
  to_postcode TEXT NOT NULL,
  move_date DATE,
  checklist_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_household_moves_user ON household_moves(user_id);
