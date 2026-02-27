-- Allow string card_id (e.g. journey-home, tip-home) for user likes; drop FK to cards
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_card_id_fkey;
ALTER TABLE likes ALTER COLUMN card_id TYPE TEXT USING card_id::TEXT;
