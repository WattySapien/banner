CREATE TABLE IF NOT EXISTS support_messages (
  id text PRIMARY KEY,
  customer_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  sender_role text NOT NULL CHECK (sender_role IN ('customer', 'admin')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  read_by_customer integer NOT NULL DEFAULT 0 CHECK (read_by_customer IN (0, 1)),
  read_by_admin integer NOT NULL DEFAULT 0 CHECK (read_by_admin IN (0, 1)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_customer_created_idx
  ON support_messages(customer_user_id, created_at);
