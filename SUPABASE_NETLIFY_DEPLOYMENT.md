# Connect Supabase and Deploy ClipX on Netlify

This project uses one Netlify site:

- Netlify builds and serves the Vite frontend from `apps/web/dist`.
- Requests to `/api/*` are routed to the Express API in a Netlify Function.
- The API connects to the Supabase PostgreSQL database.
- Authentication is handled by ClipX itself, not Supabase Auth.
- Supabase credentials and database access remain on the server; they are not embedded in the Vite browser bundle.

The checked-in `netlify.toml` already contains the build command, publish directory, function directory, API redirects, SPA fallback, and Node.js version.

## Before you begin

You need:

- A Supabase project.
- A Netlify site connected to this Git repository.
- Node.js 20 or newer installed locally.
- The repository cloned locally and dependencies installed with `npm ci`.

Never commit a database URL, database password, `.env` file, or administrator password to Git.

## 1. Copy the two Supabase database URLs

1. Open the Supabase project dashboard.
2. Select **Connect** at the top of the project.
3. Copy these connection strings:
   - **Direct connection** (port `5432`) for migrations and administrative scripts.
   - **Transaction pooler** (port `6543`) for the deployed Netlify Function.
4. Replace the password placeholder in each copied URL with the project's database password.

Use the URLs as follows:

| Variable | Supabase connection | Used by |
| --- | --- | --- |
| `DIRECT_DATABASE_URL` | Direct connection, port `5432` | Local schema migration |
| `DATABASE_URL` | Transaction pooler, port `6543` | Netlify Function at runtime |

The transaction pooler is appropriate for serverless traffic. The project already disables prepared statements for compatibility with transaction pooling.

If the machine running the migration cannot reach Supabase's IPv6 direct endpoint, use the Supabase **Session pooler** connection on port `5432` for the migration instead.

> If the database password contains reserved URL characters such as `@`, `:`, `/`, `?`, `#`, or `%`, URL-encode the password before placing it in the connection string.

## 2. Apply the database schema

From the repository root, run:

```bash
DIRECT_DATABASE_URL='postgresql://YOUR_DIRECT_CONNECTION_STRING' npm run db:migrate
```

A successful run prints:

```text
Applied 0001_banking_schema.sql
```

This creates the tables used by the API. Run migrations from a trusted local or CI environment, not inside a Netlify Function.

### Optional: create the first administrator

Use the runtime pooler URL to create or promote an administrator:

```bash
DATABASE_URL='postgresql://YOUR_TRANSACTION_POOLER_STRING' \
ADMIN_EMAIL='admin@example.com' \
ADMIN_PASSWORD='use-a-long-unique-password' \
npm run db:bootstrap-admin
```

The password must contain at least 12 characters. Remove the credentials from shell history where appropriate and do not add `ADMIN_EMAIL` or `ADMIN_PASSWORD` to Netlify; they are only needed while running this command.

### Optional: copy existing local SQLite data

If `clipx.db` contains data that must be moved to Supabase, apply the schema first and then run:

```bash
DIRECT_DATABASE_URL='postgresql://YOUR_DIRECT_CONNECTION_STRING' npm run db:migrate:sqlite
```

Back up the production database before repeating an import. Skip this step for a new installation.

## 3. Configure the Netlify site

If the repository is not connected yet:

1. In Netlify, choose **Add new project** and import the Git repository.
2. Keep the base directory at the repository root.
3. Netlify should detect `netlify.toml`. Confirm the resolved settings are:

```text
Build command: npm run build --workspace @clipx/web
Publish directory: apps/web/dist
Functions directory: apps/api/netlify/functions
Node version: 20
```

Do not set the Netlify base directory to `apps/web`; doing so prevents the root configuration and monorepo workspaces from resolving correctly.

## 4. Add the Netlify environment variables

Open the site's environment-variable settings and add:

```text
DATABASE_URL=<Supabase transaction-pooler URL on port 6543>
NODE_ENV=production
SESSION_DAYS=7
```

Set `DATABASE_URL` as a secret/sensitive value and make it available to **Functions** in the Production context. Never prefix a database URL, database password, service-role key, or other secret with `VITE_`: Vite embeds matching variables in the public browser bundle.

If Deploy Previews should use the API, give them a separate preview database rather than production credentials.

Normally, do not add any of the following:

- `DIRECT_DATABASE_URL`: migrations should not run during requests or deploys.
- `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY`: the deployed ClipX application does not need these because its server connects through `DATABASE_URL`.
- Supabase service-role key: it bypasses Row Level Security and must never be exposed to the browser.
- `CORS_ORIGINS`: same-origin frontend/API requests already work. Add it only if a separate browser origin calls this API directly; use a comma-separated list of full origins such as `https://app.example.com,https://preview.example.com`.

After changing a Netlify environment variable, trigger a new deploy so the function receives the new value.

## 5. Deploy

Before pushing, verify the project locally:

```bash
npm ci
npm run check
npm test
npm run build
```

Commit and push the repository. Netlify will build and deploy automatically. Alternatively, open **Deploys** in Netlify and trigger a production deploy from the connected branch.

The API and frontend share the same public domain. For example:

```text
Frontend: https://YOUR-SITE.netlify.app/
API:      https://YOUR-SITE.netlify.app/api
Health:   https://YOUR-SITE.netlify.app/api/health
```

## 6. Verify the connection

Open the health endpoint:

```text
https://YOUR-SITE.netlify.app/api/health
```

The expected response resembles:

```json
{
  "status": "ok",
  "storage": "postgres",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Then verify:

1. The landing page loads.
2. A new user can sign up, log out, and log back in.
3. Refreshing a protected page keeps the session active.
4. Directly opening a frontend route does not return a 404.
5. Transfers and settings changes remain after a new deploy.
6. The administrator account can access the admin area.

You can also open Supabase's Table Editor and confirm that signup creates records in `users`, `local_credentials`, `user_preferences`, and `sessions`.

## Troubleshooting

### `/api/health` returns a server error

- Confirm Netlify has `DATABASE_URL`, not `DIRECT_DATABASE_URL`, for the function runtime.
- Confirm the URL is the Supabase transaction pooler URL and uses port `6543`.
- Check that the password placeholder was replaced and special characters were URL-encoded.
- Check the latest function log in Netlify.
- Confirm the Supabase project is running and the migration completed.

### The build cannot find a workspace or package

- Keep Netlify's base directory at the repository root.
- Confirm `netlify.toml`, the root `package.json`, and `package-lock.json` are committed.
- Use Node.js 20 or newer.

### The site works, but signup or login fails

- Confirm `NODE_ENV=production` so the session cookie is marked `Secure`.
- Use the Netlify HTTPS URL, not an HTTP mirror.
- Inspect the Netlify Function logs for a database or schema error.

### Browser requests are blocked by CORS

The deployed web app calls relative `/api/*` URLs. If a genuinely separate frontend calls the API, add its exact HTTPS origin to `CORS_ORIGINS` and redeploy.

## Official references

- [Supabase: Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Netlify: Environment variables overview](https://docs.netlify.com/build/environment-variables/overview/)
