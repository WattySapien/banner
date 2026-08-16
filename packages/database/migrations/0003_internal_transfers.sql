CREATE TABLE IF NOT EXISTS internal_transfers (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  destination_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  note text NOT NULL,
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_account_id <> destination_account_id)
);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS internal_transfer_id text
  REFERENCES internal_transfers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS internal_transfers_user_created_idx
  ON internal_transfers(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_internal_transfer_idx
  ON transactions(internal_transfer_id)
  WHERE internal_transfer_id IS NOT NULL;
