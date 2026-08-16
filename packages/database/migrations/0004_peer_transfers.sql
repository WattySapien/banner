CREATE TABLE IF NOT EXISTS peer_transfers (
  id text PRIMARY KEY,
  sender_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  recipient_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  destination_account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  note text NOT NULL,
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_user_id <> recipient_user_id),
  CHECK (source_account_id <> destination_account_id)
);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS peer_transfer_id text
  REFERENCES peer_transfers(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_single_transfer_link'
      AND conrelid = 'transactions'::regclass
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_single_transfer_link
      CHECK (num_nonnulls(internal_transfer_id, peer_transfer_id) <= 1);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS peer_transfers_sender_created_idx
  ON peer_transfers(sender_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS peer_transfers_recipient_created_idx
  ON peer_transfers(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_peer_transfer_idx
  ON transactions(peer_transfer_id)
  WHERE peer_transfer_id IS NOT NULL;
