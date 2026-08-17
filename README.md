# Ardenvia Bank

Ardenvia Bank is a Vite/React banking interface with an Express API and PostgreSQL persistence, organized as an npm-workspaces monorepo for Vercel.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design, [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel, and [DEPLOYMENT_NETLIFY.md](./DEPLOYMENT_NETLIFY.md) for Netlify.

```bash
npm install
npm run dev
```

Local development uses the SQLite fallback when `DATABASE_URL` is absent. Vercel and Netlify deployments always use PostgreSQL.
