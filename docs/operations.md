# Operations

Hall Ledger keeps its own users, sessions, and institution data. There is no third-party login.

## Database

Local development uses SQLite:

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

The demo institution is `demo`. The seeded owner is `owner@demo.hallledger.test` / `DemoOwner-2026` unless `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD` are set. Change that password before any shared deployment.

Production should use PostgreSQL:

1. In `prisma/schema.prisma`, set `provider = "postgresql"`.
2. Set `DATABASE_URL` to the Postgres URL.
3. Run `npx prisma migrate dev` to create the SQL migration, then deploy it.
4. Apply `prisma/postgres/slot-check.sql` so a slot cannot end before it starts.
5. Run `npm run db:seed` once.

SQLite files do not persist on Vercel or Netlify. Point `DATABASE_URL` at a hosted Postgres database before relying on the live site.

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
