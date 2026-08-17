# Ardenvia Bank architecture

Ardenvia Bank is an npm-workspaces monorepo with independently deployable web and API applications.

```text
Browser -> apps/web (Vite/React)
              -> same-origin /api proxy
                   -> apps/api (Express on Vercel Functions)
                        -> Supabase PostgreSQL transaction pooler
```

The same workspaces support two deployment topologies:

- Vercel: separate web and API projects connected to the same repository.
- Netlify: one site serving the web build and the Express API through a Netlify Function.

## Workspaces

- `apps/web`: React user and administrator interfaces, plus the same-origin API proxy.
- `apps/api`: function-safe Express API and a separate local HTTP entrypoint.
- `packages/contracts`: shared Zod validation and TypeScript response types.
- `packages/database`: canonical Drizzle schema, SQL migration, and pooled runtime client.

The API never listens or performs migrations when imported by Vercel or Netlify. `src/local-server.ts` is the only entrypoint that opens a local port. It uses the existing repository-root SQLite database when `DATABASE_URL` is absent in development, and PostgreSQL when it is configured. Production functions remain PostgreSQL-only. Database schema changes are explicit commands.

## Authentication

Email/password authentication remains application-managed. Login and signup issue a random session token in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie. PostgreSQL stores only its SHA-256 hash. Every protected request resolves its identity from that session; browser-supplied user IDs are not trusted.

## Database connections

`DATABASE_URL` is the Supabase transaction-pooler connection used by serverless runtime traffic. Prepared statements are disabled for transaction-pooler compatibility. `DIRECT_DATABASE_URL` is reserved for migrations and administration.

During local development, a Supabase transaction-pooler URL on port 6543 is automatically converted to the corresponding session-pooler port 5432. This avoids repeated short-lived transaction-pooler connection stalls in the long-running local API while production serverless functions continue using port 6543.

Transfers lock the source account with `SELECT ... FOR UPDATE` and update the balance and transaction record in one database transaction.

Support conversations are persisted by customer user ID. Customer routes derive that ID exclusively from the authenticated session. Administrator conversation routes use the selected customer ID only after the existing local-network and administrator authorization checks pass.

## Local development

```bash
npm install
npm run dev
```

The web app runs on port 3000 and proxies `/api` to the API on port 5000. No environment file is required for SQLite-backed local development. To exercise PostgreSQL locally, copy `.env.example` to `.env`, set the connection strings, and run `npm run db:migrate` before starting the application.
