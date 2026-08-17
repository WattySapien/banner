# Security hardening log

Implemented in this pass:

- Per-IP rate limits for signup, login, admin login, transfers, and card-detail reveals.
- `__Host-ardenvia_session` cookies with `HttpOnly`, `Secure` in production, and `SameSite=Strict`.
- CSP, HSTS, Permissions-Policy, frame, referrer, and MIME-sniffing protections.
- Twelve-character minimum passwords for new customer and administrator accounts.
- Server-side PNG/WebP pixel-dimension checks for avatar uploads.
- PostgreSQL and SQLite security audit-event storage for authentication and card-management actions.
- Database migration `0011_security_audit_events.sql`.

Intentionally excluded per product direction:

- MFA and step-up authentication for administrators.

Operational requirements:

- Run `npm run db:migrate` against production after deployment.
- Keep `CARD_DATA_ENCRYPTION_KEY` in the deployment secret store and plan a versioned key-rotation process before production card volume grows.
- Review audit events regularly and restrict database access to a least-privilege application role.
