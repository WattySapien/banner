CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  profile_image_url text,
  is_admin integer NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  is_active integer NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS local_credentials (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('checking', 'savings')),
  masked_number text NOT NULL,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  balance_cents integer NOT NULL,
  available_balance_cents integer NOT NULL,
  interest_rate_bps integer
);

CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  description text NOT NULL,
  merchant text NOT NULL,
  category text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  status text NOT NULL CHECK (status IN ('completed', 'pending', 'failed')),
  reference text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cards (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  holder_name text NOT NULL,
  last_four text NOT NULL,
  network text NOT NULL DEFAULT 'Visa' CHECK (network = 'Visa'),
  type text NOT NULL CHECK (type IN ('physical', 'virtual')),
  status text NOT NULL CHECK (status IN ('active', 'frozen')),
  spending_limit_cents integer NOT NULL,
  expires text NOT NULL
);

CREATE TABLE IF NOT EXISTS beneficiaries (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  bank_name text NOT NULL,
  masked_account text NOT NULL,
  initials text NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_flow (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month text NOT NULL,
  sort_order integer NOT NULL,
  income_cents integer NOT NULL,
  spending_cents integer NOT NULL,
  PRIMARY KEY (user_id, month)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  transaction_alerts integer NOT NULL DEFAULT 1 CHECK (transaction_alerts IN (0, 1)),
  monthly_summary integer NOT NULL DEFAULT 1 CHECK (monthly_summary IN (0, 1)),
  show_balances integer NOT NULL DEFAULT 1 CHECK (show_balances IN (0, 1))
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts(user_id);
CREATE INDEX IF NOT EXISTS transactions_account_date_idx ON transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS beneficiaries_user_idx ON beneficiaries(user_id);
