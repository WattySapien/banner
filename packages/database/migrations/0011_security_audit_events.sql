CREATE TABLE IF NOT EXISTS security_audit_events (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  resource_id text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_audit_events_user_created_idx ON security_audit_events(user_id, created_at DESC);
