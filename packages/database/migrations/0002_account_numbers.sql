ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_account_number_format'
      AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_account_number_format
      CHECK (account_number IS NULL OR account_number ~ '^[0-9]{10}$');
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_account_number_unique_idx
  ON accounts(account_number)
  WHERE account_number IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_assigned_account_number_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.account_number IS NOT NULL THEN
    IF NEW.account_number IS DISTINCT FROM OLD.account_number
      OR NEW.masked_number IS DISTINCT FROM right(OLD.account_number, 4) THEN
      RAISE EXCEPTION 'Account numbers cannot be changed once assigned'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.account_number IS NOT NULL THEN
    NEW.masked_number := right(NEW.account_number, 4);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS accounts_account_number_immutable ON accounts;
CREATE TRIGGER accounts_account_number_immutable
BEFORE UPDATE OF account_number, masked_number ON accounts
FOR EACH ROW
EXECUTE FUNCTION prevent_assigned_account_number_change();
