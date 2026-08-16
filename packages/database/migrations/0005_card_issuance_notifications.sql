ALTER TABLE cards ADD COLUMN IF NOT EXISTS pan_ciphertext text;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pan_iv text;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pan_auth_tag text;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pan_fingerprint text;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS created_at timestamptz;
UPDATE cards SET created_at=now() WHERE created_at IS NULL;
ALTER TABLE cards ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE cards ALTER COLUMN created_at SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cards_pan_fingerprint_idx ON cards(pan_fingerprint) WHERE pan_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('card_issued')),
  title text NOT NULL,
  message text NOT NULL,
  resource_id text,
  is_read integer NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);
