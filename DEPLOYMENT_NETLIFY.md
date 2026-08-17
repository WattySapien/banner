# Deploy Ardenvia Bank to Netlify

Ardenvia Bank deploys to one Netlify site: Vite assets are served from `apps/web/dist`, and `/api/*` is rewritten to the Express application in a Netlify Function. PostgreSQL remains hosted by Supabase.

## 1. Prepare PostgreSQL

From a trusted local or CI environment, configure the Supabase direct connection and apply the schema:

```bash
DIRECT_DATABASE_URL='postgresql://...' npm run db:migrate
```

Optionally copy the existing SQLite data and bootstrap an administrator:

```bash
DIRECT_DATABASE_URL='postgresql://...' npm run db:migrate:sqlite

DATABASE_URL='postgresql://...' \
ADMIN_EMAIL='admin@example.com' \
ADMIN_PASSWORD='a-long-unique-password' \
npm run db:bootstrap-admin
```

## 2. Create the Netlify site

Import the repository into Netlify and leave the Base directory at the repository root. Netlify reads the checked-in `netlify.toml`, which configures the workspace build, publish directory, function directory, API rewrite, SPA fallback, Node 20, caching, and security headers.

Set these environment variables for Production and Deploy Previews:

```text
DATABASE_URL=<Supabase transaction-pooler URL>
CARD_DATA_ENCRYPTION_KEY=<private 32-byte base64 key>
SESSION_DAYS=7
NODE_ENV=production
```

Generate the card-data key in a trusted terminal with `openssl rand -base64 32`, store it as a sensitive Functions-only value, and never commit or print it. Keep the same key across deploys so existing issued cards remain decryptable.

`CORS_ORIGINS` is only required if another browser origin calls the API directly. Same-origin requests through the Netlify site are accepted automatically.

Do not add `DIRECT_DATABASE_URL` to the deployed site unless a deliberate deployment migration job requires it. The application never migrates or seeds the database during a function invocation.

## 3. Verify

Before deploying:

```bash
npm ci
npm run check
npm test
npm run build
npm audit
```

After deploying, verify `/api/health`, signup/login/logout, password changes, direct SPA navigation, administrator authorization, transfers, and persistence after a new deploy.

For a full concurrency test against a disposable migrated database:

```bash
TEST_DATABASE_URL='postgresql://...' npm test
```
