# Operations

Hall Ledger keeps its own users, sessions, and institution data. There is no third-party login.

## Database

Hall Ledger uses PostgreSQL everywhere. Production runs on Supabase (project `hall-ledger`, ref `hrvmjdoedikaxfnseztn`, region ap-south-1). Only Postgres is used; Supabase Auth and the Data API are not. RLS is enabled with no policies on every table, so the anon/authenticated REST roles can read and write nothing; the app connects server-side through Prisma as the `postgres` role.

Local development needs a local Postgres:

```bash
cp .env.example .env          # edit DATABASE_URL / DIRECT_URL
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The demo institution is `demo`. The seeded owner is `owner@demo.hallledger.test`; set `SEED_OWNER_PASSWORD` when seeding (the default `DemoOwner-2026` is for local use only).

Production (Supabase):

- `DATABASE_URL` = Supabase "Transaction pooler" string (port 6543) plus `?pgbouncer=true&connection_limit=1`.
- `DIRECT_URL` = Supabase "Direct connection" string (port 5432), or the "Session pooler" (port 5432) if your network is IPv4-only.
- New schema changes: `npx prisma migrate dev` against a local DB, commit the migration, then `npx prisma migrate deploy` with production `DIRECT_URL`. The Slot time CHECK and RLS are in the migrations.

Tests reset their database. They only run when `TEST_DATABASE_URL` / `E2E_DATABASE_URL` point at a database whose name contains `test`. Never point them at Supabase.

`netlify.toml` builds the Next.js app and does not set `DATABASE_URL`. Put the database URLs and `APP_URL` in the host's environment and keep `TRUST_PROXY=1` on Netlify.

Login lockout is per email and client IP, so a bad password from somewhere else does not lock the real user. Signup, reset, invites, and new schools are limited per account as well as per IP.

## Email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`. Links are built from `APP_URL` only.

If SMTP is unset outside production, the message is printed and appended to `.mail-dev.log`. That file is gitignored.

## Backups

```bash
pg_dump "$DATABASE_URL" --format=custom --file "/var/backups/hall-ledger-$(date +%F).dump"
```

Run that from cron daily and keep the dumps off the database host. Restore with `pg_restore`.

## Sessions

Session cookies are `__Host-hl_session`: HttpOnly, Secure, SameSite=Lax, Path=/. The database stores SHA-256 of the cookie value, optionally peppered with `SESSION_SECRET`. Changing the secret signs every user out.

Passwords use bcrypt with cost 12. A password change or reset deletes every session for that user.
