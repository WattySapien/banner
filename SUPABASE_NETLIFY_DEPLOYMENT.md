# Supabase and Netlify Deployment Guide

Last reviewed: August 15, 2026

This guide reflects the current ClipX deployment architecture:

- Netlify serves the Vite frontend from `apps/web/dist`.
- Netlify Functions run the Express API.
- `/api/*` is routed to the API by the checked-in `netlify.toml`.
- The API connects to Supabase PostgreSQL from the server.
- ClipX authentication remains application-managed; Supabase Auth is not used.
- No database credential or Supabase client is exposed through the browser bundle.

## Security rules

1. Never commit `.env`, database URLs, passwords, tokens, private keys, service-role keys, or administrator credentials.
2. Never paste a real secret into documentation, a Git commit, an issue, a screenshot, build output, or a support message.
3. Do not prefix secrets with `VITE_`. Vite embeds matching values in public frontend JavaScript.
4. Store production secrets in Netlify's environment-variable manager and mark sensitive values as secret.
5. Give Deploy Previews a separate non-production database or no database access.
6. Run database migrations manually from a trusted environment. Do not run migrations inside request-handling functions.
7. If a secret is exposed, rotate it immediately in Supabase or Netlify and redeploy.

The repository's `.gitignore` excludes `.env` files. Example files must contain placeholders only.

## Environment variables

### Netlify production runtime

| Name | Scope | Sensitive | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Functions | Yes | Supabase transaction-pooler connection used by the API |
| `NODE_ENV` | Functions | No | Must be `production` so session cookies are secure |
| `SESSION_DAYS` | Functions | No | Session duration; the application accepts `1` through `90` |
| `CORS_ORIGINS` | Functions | No | Optional comma-separated origins for a genuinely separate frontend |

### Local administration only

| Name | Sensitive | Purpose |
| --- | --- | --- |
| `DIRECT_DATABASE_URL` | Yes | Direct or session-pooler connection for migrations and administration |
| `ADMIN_EMAIL` | Personal data | Temporary input for administrator bootstrap |
| `ADMIN_PASSWORD` | Yes | Temporary input for administrator bootstrap; minimum 12 characters |
| `SQLITE_DATABASE_PATH` | Potentially | Optional source path for a local SQLite import |

Do not add `DIRECT_DATABASE_URL`, `ADMIN_EMAIL`, or `ADMIN_PASSWORD` to the deployed Netlify site. Remove temporary administrator values from the local `.env` after bootstrap.

The application does not need a Supabase publishable key, anon key, project URL, or service-role key. It connects through the server-only `DATABASE_URL`.

## 1. Prepare Supabase securely

1. Open the Supabase dashboard and select the correct project.
2. Open the project's **Connect** panel.
3. Copy the **Direct connection** for migrations.
4. Copy the **Transaction pooler** connection for Netlify Functions.
5. Store both values only in approved secret storage; do not paste them into this guide or commit them.

Supabase currently recommends a direct connection on port `5432` for migrations and a transaction pooler on port `6543` for temporary serverless connections. If the trusted migration environment cannot reach the IPv6 direct endpoint, use the Supabase session pooler on port `5432` for the migration instead.

The application already disables prepared statements and limits each serverless database client to one connection for transaction-pooler compatibility.

## 2. Configure local deployment secrets

From the repository root, create a local environment file from the placeholder template:

```bash
cp .env.example .env
chmod 600 .env
```

Open `.env` locally and replace only the required placeholders. Do not share or commit the completed file. Confirm that Git ignores it before continuing:

```bash
git check-ignore .env
```

The command should print `.env`. If it prints nothing, stop and fix `.gitignore` before adding any secret.

## 3. Apply the database schema

After setting `DIRECT_DATABASE_URL` in the ignored root `.env`, run:

```bash
npm ci
npm run db:migrate
```

The migration runner prefers `DIRECT_DATABASE_URL`. If that direct endpoint is unreachable from an IPv4-only development network and the runtime `DATABASE_URL` is a Supabase transaction-pooler URI, it retries through the corresponding session pooler on port `5432`. It does not retry SQL or schema errors, and it never prints connection strings.

A successful migration prints:

```text
Applied 0001_banking_schema.sql
```

Do not print the environment, enable shell tracing, or include a connection string directly in the command.

### Optional: bootstrap the first administrator

Temporarily add `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters to the ignored root `.env`, then run:

```bash
npm run db:bootstrap-admin
```

After the command succeeds, remove both administrator values from `.env`. Do not store this password in Netlify or documentation.

### Access the local-only administrator console

Administrator authentication uses the dedicated `/admin/login` route. Both the login endpoint and every `/api/admin/*` endpoint accept only loopback, RFC 1918 private IPv4, IPv4 link-local, IPv6 unique-local, or IPv6 link-local client addresses. This restriction is enforced by the API and cannot be bypassed by navigating directly to an admin page.

Start Netlify Dev and open `http://localhost:8888/admin/login` (or the port displayed by Netlify Dev). A successful administrator login redirects to `/admin`.

The administrator console is intentionally unavailable through the public Netlify URL. Netlify sees internet visitors by their public address even when their device is on a private home or office network. Use Netlify Dev locally, or place a separately controlled private VPN/reverse proxy in front of the application if remote administration is required later.

### Optional: migrate local SQLite data

Apply the PostgreSQL schema first, back up the target database, and then run:

```bash
npm run db:migrate:sqlite
```

The importer uses `clipx.db` by default. Set `SQLITE_DATABASE_PATH` locally only when the source is elsewhere. Skip this step for a new deployment.

## 4. Confirm the Netlify project configuration

Connect the Git repository to one Netlify project and leave the base directory unset so Netlify builds from the repository root. The root `netlify.toml` is the source of truth.

Confirm the resolved settings:

| Setting | Value |
| --- | --- |
| Build command | `npm run build --workspace @clipx/web` |
| Publish directory | `apps/web/dist` |
| Functions directory | `apps/api/netlify/functions` |
| Node.js build version | Value configured in `netlify.toml` |

Do not set the base directory to `apps/web`; the build needs the root npm workspace and lockfile.

## 5. Add Netlify environment variables

In the Netlify project settings, open the environment-variable manager.

1. Create `DATABASE_URL` using the Supabase **Transaction pooler** value.
2. Mark it sensitive and scope it to **Functions** and the **Production** deploy context.
3. Set `NODE_ENV` to `production` for Functions.
4. Set `SESSION_DAYS` to an allowed integer.
5. Add `CORS_ORIGINS` only when a separate browser origin calls the API.
6. Save the variables and trigger a new production deploy.

Do not place secrets in `netlify.toml`; it is committed to Git. Do not make `DATABASE_URL` available to frontend build code.

For Deploy Previews, use a distinct preview Supabase project or omit `DATABASE_URL`. Never reuse the production database credential in an untrusted preview.

## 6. Deploy

Validate the repository before pushing:

```bash
npm ci
npm run check
npm test
npm run build
```

Commit only source code, configuration without secrets, and placeholder environment examples. Push the deployment branch or trigger a production deploy in Netlify.

The frontend and API share one origin:

```text
Frontend: https://<netlify-site-domain>/
API:      https://<netlify-site-domain>/api
Health:   https://<netlify-site-domain>/api/health
```

Replace the placeholder locally; do not add a private/custom domain to this repository unless it is intentionally public.

### Reproduce the Netlify runtime locally

The repository's `[dev]` configuration starts only the Vite frontend on the dedicated internal port `3999`; Netlify Dev serves the public proxy on port `8888` and runs the API as a Netlify Function. The npm command selects the web workspace explicitly so the CLI does not pause at a monorepo project prompt. This avoids starting the standalone development API alongside the Function emulator or colliding with the regular Vite server on port `3000`.

Create an ignored root `.env` containing a non-production or otherwise explicitly approved Supabase transaction-pooler `DATABASE_URL`. Do not commit it, paste it into documentation, or pass it directly on the command line. Then run:

```bash
npm run dev:netlify
```

Verify these local endpoints:

```text
Frontend: http://localhost:8888/
Health:   http://localhost:8888/api/health
Signup:   http://localhost:8888/signup
```

The health response must report `"storage": "postgres"` before testing signup. Netlify Dev prints Function errors locally, which can distinguish a missing environment variable, rejected database connection, or unapplied migration without exposing the detailed error to the browser.

## 7. Verify without exposing data

Open the health endpoint. A healthy deployment returns JSON containing:

```json
{
  "status": "ok",
  "storage": "postgres",
  "timestamp": "<ISO-8601 timestamp>"
}
```

Then verify:

1. The landing page loads over HTTPS.
2. Signup, login, logout, and session refresh work.
3. Direct navigation to frontend routes does not return a 404.
4. Authorized transfers and settings changes persist after redeployment.
5. Standard users cannot access administrator endpoints.
6. The intended administrator can access the admin area.

Use synthetic test accounts and non-sensitive test data. Do not paste customer records, session values, credentials, complete database errors, or full request headers into logs or reports.

## Troubleshooting

### The health endpoint returns an error

- Confirm `DATABASE_URL` exists in the Netlify Production context and is scoped to Functions.
- Confirm it is the transaction-pooler connection, not the migration connection.
- If the Function log reports `ENETUNREACH`, check that `DATABASE_URL` does not use the Supabase direct host on port `5432`. The direct endpoint may require IPv6; Netlify Functions and Netlify Dev should use the transaction pooler host on port `6543`.
- Database operations have an application deadline shorter than Netlify's Function deadline. A stalled connection is discarded so later requests do not queue behind it. Responses identify a safe stage such as `admin.customer.database.create`; they never include SQL, credentials, or connection details.
- If customer creation appears to time out, check whether the customer exists before submitting the form again. The database transaction may have committed before an older Function instance timed out while preparing its response.
- Confirm the migration completed and the Supabase project is available.
- Review Netlify Function logs, but redact usernames, hosts, connection strings, query parameters, cookies, and tokens before sharing any excerpt.
- Rotate the database password if a log or screenshot exposed any part of the credential.

### The build cannot resolve a workspace

- Leave the Netlify base directory unset.
- Confirm `netlify.toml`, the root `package.json`, and `package-lock.json` are committed.
- Confirm the build uses the Node.js version configured by the repository.

### Login does not persist

- Confirm the site is using HTTPS.
- Confirm `NODE_ENV=production` is available to the Function.
- Inspect cookie behavior without copying cookie values into an issue or message.

### Requests are blocked by CORS

The Netlify-hosted frontend should call relative `/api/*` routes and normally needs no CORS override. If a separate frontend is required, set only its exact HTTPS origin in `CORS_ORIGINS` and redeploy.

## Secret rotation checklist

If a database URL or password is exposed:

1. Reset the database password in Supabase.
2. Replace `DATABASE_URL` in Netlify without displaying it in logs or chat.
3. Replace `DIRECT_DATABASE_URL` in trusted local or CI secret storage.
4. Trigger a clean production deploy.
5. Remove the exposed value from logs and Git history using an approved incident-response process.
6. Review Supabase and Netlify activity for unexpected access.

## Official references

- [Supabase: Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Using Postgres.js](https://supabase.com/docs/guides/database/postgres-js)
- [Netlify: Monorepo configuration](https://docs.netlify.com/build/configure-builds/monorepos/)
- [Netlify: Manage build dependencies](https://docs.netlify.com/build/configure-builds/manage-dependencies/)
- [Netlify: Configure Functions](https://docs.netlify.com/build/functions/configuration/)
- [Netlify: Environment variables](https://docs.netlify.com/build/environment-variables/overview/)
