# ClipX Banking API

The Express API is exposed below `/api`. JSON request bodies are limited to 1 MB. Except for health, API metadata, login, signup and logout, endpoints require the `clipx_session` HTTP-only cookie.

## Public endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api` | API metadata |
| GET | `/api/health` | Runtime and storage health |
| POST | `/api/auth/local/signup` | Create an account and session |
| POST | `/api/auth/local/login` | Authenticate and create a session |
| POST | `/api/auth/logout` | Revoke the current session |

Login and signup accept `{ "email": "...", "password": "..." }`. Passwords must contain at least eight characters.

## Customer endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/auth/user` | Current user profile |
| GET | `/api/overview` | Banking totals, accounts and cash flow |
| GET | `/api/accounts` | Accounts |
| GET | `/api/transactions` | Transaction history |
| GET | `/api/cards` | Cards |
| PATCH | `/api/cards/:cardId` | Freeze/unfreeze or change a card limit |
| GET | `/api/beneficiaries` | Transfer recipients |
| POST | `/api/transfers` | Atomically create a transfer |
| GET | `/api/settings` | Profile and preferences |
| PATCH | `/api/settings/profile` | Update the profile |
| PATCH | `/api/settings/preferences` | Update preferences |
| PATCH | `/api/settings/password` | Change password and revoke other sessions |

Transfers accept `sourceAccountId`, `beneficiaryId`, a positive `amount` up to 50,000, and an optional `note`.

## Administrator endpoints

These routes additionally require the session user to have administrator access.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/stats` | Operational totals |
| GET | `/api/admin/users` | Customers |
| POST | `/api/admin/users` | Create a customer and optional account |
| GET | `/api/admin/users/:userId` | Customer details |
| PATCH | `/api/admin/users/:userId` | Update identity, status or role |
| GET | `/api/admin/transactions` | Cross-customer transaction monitoring |

Validation errors return `400`, missing authentication returns `401`, insufficient permissions return `403`, missing records return `404`, conflicts return `409`, and rejected business operations return `422`.
