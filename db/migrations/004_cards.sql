CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_key TEXT,
  type TEXT CHECK (type IN ('cheapest','greenest','balance','tip')),
  title TEXT NOT NULL,
  description TEXT,
  impact_band TEXT CHECK (impact_band IN ('low','medium','high')),
  effort_band TEXT CHECK (effort_band IN ('low','medium','high')),
  created_at TIMESTAMP DEFAULT now()
);
