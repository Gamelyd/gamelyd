# Gamelyd (Next.js)

A full port of the Gamelyd esports tournament platform - the Go/Gin/MongoDB
backend and the React frontend - unified into a single, strongly-typed
**Next.js 16 (App Router)** application.

- **Language:** TypeScript, strict mode, **zero `any`** (enforced by ESLint)
- **Styling:** Tailwind CSS v4 (design tokens mirror the original teal-on-dark theme)
- **Validation:** Zod schemas shared across the client and server
- **Backend:** Modern Next.js **Server Actions** + **Route-less service layer**,
  with MongoDB, JWT (`jose`), bcrypt and SMTP all kept **server-only**
- **Auth:** JWT stored in an **httpOnly cookie** - never exposed to client JS

## Architecture

```
src/
  app/                     App Router pages (Home, auth, tournaments, profile…)
  components/              UI primitives, layout, tournament & profile views
  context/AuthContext.tsx  Client auth state, seeded from the server
  lib/
    schemas/               Zod schemas + inferred types (the single source of truth)
    result.ts              Typed ActionResult<T> discriminated union
    validate.ts            Safe Zod parsing helper
  server/                  ⛔ server-only (import "server-only")
    env.ts                 Validated environment access
    db.ts                  Cached MongoDB client + typed collections
    documents.ts           MongoDB document shapes
    serialize.ts           Document → public schema mappers
    auth/                  jwt (jose), password (bcrypt), cookie session
    email/                 nodemailer transport + HTML templates
    services/              Business logic (users, tournaments, draws, contact…)
    actions/               "use server" entry points the UI calls
  proxy.ts                 Route protection (Next 16 proxy convention)
```

The browser only ever calls **Server Actions**. Secrets (Mongo URI, JWT key,
SMTP credentials) live exclusively under `src/server/**` and are never bundled
into client code.

## Getting started

1. Copy the environment template and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:3000

## Environment variables

| Variable | Scope | Description |
| --- | --- | --- |
| `MONGODB_URL` | server | MongoDB connection string |
| `DB_NAME` | server | Database name (default `cluster0`) |
| `SECRET_KEY` | server | JWT HS256 signing key |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | server | Email delivery |
| `MAIL_FROM` / `ADMIN_EMAIL` | server | From + admin notification address |
| `NEXT_PUBLIC_APP_URL` | public | Base URL used in emails/links |
| `NEXT_PUBLIC_PAYSTACK_KEY` | public | Paystack public key |

## Scripts

- `npm run dev` - start the dev server
- `npm run build` - production build
- `npm run lint` - ESLint (fails on any `any`)
- `npx tsc --noEmit` - type check
