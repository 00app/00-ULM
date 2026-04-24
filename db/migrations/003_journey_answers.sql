CREATE TABLE journey_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  journey_key TEXT NOT NULL,
  question_key TEXT NOT NULL,
  answer TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, journey_key, question_key)
);
