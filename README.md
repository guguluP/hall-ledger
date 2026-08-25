# Hall Ledger

**Smart Classroom Availability & Section Management** — Single Building Edition

A mobile-first web app for colleges that solves classroom scheduling conflicts, vacancy blindness, and mid-semester section imbalance.

## Features

- Timetable upload + hard room/teacher conflict detection
- Vacancy search across all 26 halls (2025–26 workbook)
- Apple-inspired dark UI (Hall Ledger)
- Student list upload + consolidation proposals

## Tech

- Next.js 15 (App Router) + TypeScript + Tailwind
- Prisma + SQLite (local) / Postgres recommended for production

## Local setup

```bash
npm install
cp .env.example .env
npx prisma db push
npx prisma db seed
npm run dev
```

Open http://localhost:3000

## Deploy

Set `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` in Vercel project env. SQLite file DBs are not durable on serverless — use Postgres (e.g. Neon, Supabase) for production.
