CREATE TABLE micro_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  question_key TEXT,
  answer TEXT,
  created_at TIMESTAMP DEFAULT now()
);
