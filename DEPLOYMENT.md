# Deploy ClipX to Vercel

## 1. Provision PostgreSQL

Create a Supabase project and copy both connection strings:

- Transaction pooler (port 6543) -> `DATABASE_URL`
- Direct connection (port 5432) -> `DIRECT_DATABASE_URL`

Apply the schema from a trusted local or CI environment:

```bash
DIRECT_DATABASE_URL='postgresql://...' npm run db:migrate
```

Bootstrap the first administrator with an explicit strong password:

```bash
DATABASE_URL='postgresql://...' ADMIN_EMAIL='admin@example.com' ADMIN_PASSWORD='a-long-unique-password' npm run db:bootstrap-admin
```

To copy an existing local SQLite database after applying the schema:

```bash
DIRECT_DATABASE_URL='postgresql://...' npm run db:migrate:sqlite
```

The copy is idempotent by primary key and prints source/target row counts. Back up the PostgreSQL database before rerunning it against production data.

## 2. Create the API project

Import this Git repository into Vercel as `clipx-api` and set Root Directory to `apps/api`.

Set these environment variables for Production and Preview:

```text
DATABASE_URL=<Supabase transaction-pooler URL>
CARD_DATA_ENCRYPTION_KEY=<private 32-byte base64 key>
CORS_ORIGINS=https://your-web-domain.example
SESSION_DAYS=7
NODE_ENV=production
```

Do not expose `DIRECT_DATABASE_URL` to the deployed API unless an intentional deployment migration job needs it.

## 3. Create the web project

Import the same repository as `clipx-web` and set Root Directory to `apps/web`.

Set:

```text
API_ORIGIN=https://your-api-project.vercel.app
```

The server-side proxy forwards `/api/*` to the API project, so session cookies remain same-origin in the browser. Add every production or preview web origin to the API project's `CORS_ORIGINS`.

## 4. Verification

```bash
npm ci
npm run check
npm run build
npm audit
```

Run the PostgreSQL concurrency integration test against a migrated, disposable database:

```bash
TEST_DATABASE_URL='postgresql://...' npm test
```

After deployment, verify `/api/health`, signup/login/logout, direct SPA navigation, administrator authorization, transfer rollback on insufficient balance, and persistence after a redeployment.
