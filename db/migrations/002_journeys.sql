CREATE TABLE journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  journey_key TEXT NOT NULL,
  state TEXT CHECK (state IN ('not_started','in_progress','completed')) DEFAULT 'not_started',
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, journey_key)
);
