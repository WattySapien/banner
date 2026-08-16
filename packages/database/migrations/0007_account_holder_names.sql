UPDATE accounts AS account
SET name = trim(customer.first_name || ' ' || customer.last_name)
FROM users AS customer
WHERE customer.id = account.user_id
  AND account.name IS DISTINCT FROM trim(customer.first_name || ' ' || customer.last_name);

CREATE OR REPLACE FUNCTION enforce_account_holder_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := (
    SELECT trim(first_name || ' ' || last_name)
    FROM users
    WHERE id = NEW.user_id
  );

  IF NEW.name IS NULL OR NEW.name = '' THEN
    RAISE EXCEPTION 'Account owner must have a name';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_enforce_holder_name ON accounts;
CREATE TRIGGER accounts_enforce_holder_name
BEFORE INSERT OR UPDATE OF user_id, name ON accounts
FOR EACH ROW
EXECUTE FUNCTION enforce_account_holder_name();

CREATE OR REPLACE FUNCTION sync_account_holder_name_from_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE accounts
  SET name = trim(NEW.first_name || ' ' || NEW.last_name)
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_sync_account_holder_name ON users;
CREATE TRIGGER users_sync_account_holder_name
AFTER UPDATE OF first_name, last_name ON users
FOR EACH ROW
WHEN (OLD.first_name IS DISTINCT FROM NEW.first_name OR OLD.last_name IS DISTINCT FROM NEW.last_name)
EXECUTE FUNCTION sync_account_holder_name_from_user();
