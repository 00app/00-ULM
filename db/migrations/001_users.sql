CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  postcode TEXT,
  household TEXT,
  home_type TEXT,
  transport_baseline TEXT,
  created_at TIMESTAMP DEFAULT now()
);
