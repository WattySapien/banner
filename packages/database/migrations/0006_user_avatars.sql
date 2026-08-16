CREATE TABLE IF NOT EXISTS user_avatars (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  image_data bytea NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 2097152),
  updated_at timestamptz NOT NULL DEFAULT now()
);
