# Ardenvia Bank project progress log

This file records completed engineering milestones and their verification status. Add new entries at the top of the dated log.

## Current status

- Monorepo application: web, API, shared contracts, and database packages are operational.
- Primary deployment path: Netlify Functions with Supabase PostgreSQL.
- Local development path: Vite plus the local API, using PostgreSQL when configured or SQLite as a fallback.
- Database migrations `0001` through `0008` have been applied to the configured Supabase project.

## 2026-08-16 — Customer and administrator support conversations

### Completed

- Replaced the email-only Contact support panel with a persistent in-app customer conversation.
- Added customer-scoped message retrieval, sending, read state, polling, and account isolation.
- Added local-admin-only conversation APIs and a Communications page for every customer record.
- Added a Communications button to Customer Details and connected administrator replies to the customer's dashboard panel.
- Added PostgreSQL migration `0008_support_messages.sql` and automatic SQLite table creation.
- Added shared message validation with a 2,000-character limit and storage-level administrator verification.

### Verification

- Contracts, database, API, and web TypeScript checks passed.
- API storage tests passed, including customer/admin message exchange, read state, and rejection of non-admin replies.
- API and production web builds completed successfully.
- Applied migration `0008` to the configured Supabase database through the IPv4 session-pooler fallback.
- Added bounded client retries for transient session-read and idempotent avatar-upload failures.
- Routed local Supabase runtime connections through the stable session pooler while preserving the transaction pooler for production.
- Added bounded exponential retries to active support-conversation reads.

## 2026-08-16 — Backend history generation and user support

### Completed

- Added a guarded backend automation mode that inserts varied, backdated transaction-history fixtures into a customer's primary account without launching Chrome.
- Added SQLite and PostgreSQL support while retaining the existing mutation opt-in, local-server preflight, database-target checks, and terminal confirmation.
- Added the initial floating Contact support entry point to authenticated banking screens.

### Verification

- `npm run test:automation` passed all seven tests, including backend history insertion and the isolated browser workflow.
- `npm run check --workspace @clipx/web` passed.
- `npm run build --workspace @clipx/web` completed successfully.

## 2026-08-16 — User dashboard sign-out access

### Completed

- Added a visible desktop sign-out button beside the authenticated user's profile in the banking dashboard header.
- Retained the existing sign-out action in the mobile navigation drawer.

### Verification

- `npm run check --workspace @clipx/web` passed.

## 2026-08-16 — Automation safety and reliability hardening

### Completed

- Added an explicit `AUTOMATION_DATABASE_MUTATIONS=true` safety gate.
- Blocked automation fixture execution in production mode.
- Added PostgreSQL target matching between `AUTOMATION_DATABASE_URL` and `DATABASE_URL`.
- Added a local-only fixture bootstrap for PostgreSQL and SQLite; no fixture endpoint is exposed by the API.
- Made transaction-history setup self-sufficient by provisioning a test account, saved beneficiary, and sufficient available test balance when necessary.
- Added server health and storage preflight checks before Chrome launches.
- Replaced visible interactive password entry with masked terminal input.
- Disabled the insecure command-line `--password` option and added `CLIPX_AUTOMATION_PASSWORD` for temporary non-interactive use.
- Aligned email, count, amount, decimal precision, note length, name, URL, and balance-reserve validation with application constraints.
- Added precise partial-batch failure reports containing completed count, failed position, and created references.
- Added stable UI automation selectors for authentication and transfers.
- Added unit tests plus an isolated browser E2E test using temporary SQLite data.
- Updated the automation operator guide and safe environment template.

### Verification

- `npm run check` passed for API, web, contracts, and database workspaces.
- `npm test` passed all existing API diagnostics, network-access, and storage tests.
- `npm run test:automation` passed six tests, including the isolated headless-Chrome signup/login/transfer infrastructure workflow.
- `npm run build` produced successful API and production web builds.
- JavaScript syntax checks and `git diff --check` passed.
- `npm install` reported three high-severity dependency advisories; no forced breaking dependency upgrade was applied during this milestone.

## Previously completed milestones

- Implemented Supabase PostgreSQL migrations and IPv4 session-pooler fallback for migration environments without direct IPv6 access.
- Added security-safe API diagnostics with request IDs, error codes, and operation stages.
- Revoked all existing sessions when customers are suspended and required fresh login after restoration.
- Added Netlify Functions integration, runtime validation, and Supabase/Netlify deployment documentation.
- Added customer avatar upload, protected backend storage, and user/admin avatar rendering.
- Centralized user notifications in the navigation notification center.
- Renamed the user Settings experience to Account and retained `/settings` as a compatibility redirect.
