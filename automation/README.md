# Ardenvia Bank browser automation

This automation uses Puppeteer to verify real signup, login, and transfer flows through the Ardenvia Bank interface. Browser targets are restricted to localhost. Mutations require an explicit test-database opt-in, and every interactive confirmation is rendered in the terminal before Chrome opens.

## Safety setup

Use a dedicated development or test database. Never enable automation mutations in Netlify, Vercel, or a production environment.

Add these values to the ignored root `.env`:

```dotenv
AUTOMATION_DATABASE_MUTATIONS=true
AUTOMATION_BALANCE_RESERVE=100
```

When the API uses PostgreSQL, also copy the exact test `DATABASE_URL` value into `AUTOMATION_DATABASE_URL`:

```dotenv
DATABASE_URL=postgresql://test-runtime-connection
AUTOMATION_DATABASE_URL=postgresql://test-runtime-connection
```

The fixture bootstrap refuses PostgreSQL execution unless both URLs identify the same user, host, port, and database. It also refuses all fixture operations when `NODE_ENV=production`.

SQLite development runs use `CLIPX_DATABASE_PATH` when set, or the legacy root SQLite file by default.

## Interactive workflow

Start Ardenvia Bank:

```bash
npm run dev
```

Then run:

```bash
npm run automate
```

Choose one action in the terminal:

- **Create an account** registers an Ardenvia Bank customer through the signup UI.
- **Create transaction history through the browser** signs in to an existing customer and performs genuine saved-recipient transfers through the transfer UI.
- **Generate transaction history through the backend** adds varied, backdated test ledger entries directly to the customer's primary account and does not open Chrome.

Passwords are masked. Before Chrome opens, the script validates all input, checks `/api/health`, and verifies the active database. For transaction history, the local fixture bootstrap creates a test checking account or beneficiary when missing and tops up the first account only when its available balance cannot cover the requested batch plus the configured reserve.

## Non-interactive workflow

Never pass passwords through command-line arguments. Put the credential in a temporary environment variable:

```bash
CLIPX_AUTOMATION_PASSWORD='use-a-test-password' npm run automate -- \
  --action=create-account \
  --first-name=Automation \
  --last-name=User \
  --email=automation@ardenvia.local \
  --yes
```

Create five transaction-history entries:

```bash
CLIPX_AUTOMATION_PASSWORD='use-a-test-password' npm run automate -- \
  --action=create-transaction-history \
  --email=automation@ardenvia.local \
  --transaction-count=5 \
  --transfer-amount=10 \
  --note="Automation history entry" \
  --yes
```

Generate five entries directly through the backend:

```bash
npm run automate -- \
  --action=create-backend-history \
  --email=automation@ardenvia.local \
  --transaction-count=5 \
  --transfer-amount=10 \
  --note="Generated account history"
```

Backend-generated history is intended for fast local fixture creation. It does not send transfers or alter the account's current balance. The amount is used as a baseline and varied slightly across generated entries.

Avoid saving `CLIPX_AUTOMATION_PASSWORD` permanently. A command-line `--password` option is deliberately rejected because it can leak through shell history and process listings.

## Supported options

- `--action=create-account`, `--action=create-transaction-history`, or `--action=create-backend-history`
- `--first-name=<name>` and `--last-name=<name>` for signup
- `--email=<address>`
- `--transaction-count=<1-50>`
- `--transfer-amount=<0.01-50000>` with at most two decimal places
- `--note=<up to 80 characters>`
- `--balance-reserve=<0-50000>`
- `--base-url=http://127.0.0.1:3000`
- `--headless` for automated test environments
- `--keep-open` to leave visible Chrome open after the run
- `--yes` for a fully non-interactive, explicitly approved run

Set `CHROME_PATH` if Chrome is not installed in a standard Linux location.

## Failure reporting

Each transfer is a real committed operation. If a batch fails midway, the terminal reports the requested count, completed count, failed position, and every created reference. Completed transfers are not silently rolled back.

## Tests

Run the automation unit tests and the isolated browser workflow with:

```bash
npm run test:automation
```

The E2E test creates a temporary SQLite database and local web/API servers, performs one transfer in headless Chrome, verifies the resulting transaction, and removes the temporary files. It never connects to the configured Supabase database.
