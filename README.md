# Hall Ledger

**Smart classroom availability & section management** — Aryabhatta & Kautalya, 1st year 2025–26.

A mobile-first web app that finds free halls, flags room overlaps, and proposes section merges.

Live: https://hall-ledger.netlify.app

## Features

- **2025–26 timetable is preloaded** (16 sections · 340 slots · 27 halls) so Grid and Find work before any upload
- Format-tolerant Excel / CSV / ODS parse (any layout with days and times)
- Hard room-overlap detection on parse
- Vacancy search: a hall is free only if the *entire* window is empty (9:30 AM–5:30 PM is afternoon, not 5:30 AM)
- Student list upload + consolidation proposals when a section drops below 25
- Apple-inspired dark UI

## Halls

27 rooms: Aryabhatta `10`–`405` plus Kautalya `ME-01`–`ME-104`.

## Tech

- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind
- No database is used at runtime (bundled seed + latest publish + browser cache)
- Prisma schema is kept for a future Postgres move; it is only generated at build time

## Local setup

```bash
npm install
cp .env.example .env   # optional for local work
npm run dev
```

Open http://localhost:3000

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run lint` | ESLint (CI fails on errors) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: unit tests, API route tests, seed golden numbers |
| `npm run build` | `prisma generate` then `next build` |

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `PUBLISH_SECRET` | Runtime, **required in production** | Shared secret for `POST /api/timetable/publish`. Without it, production publish is disabled (503). Wrong or missing value gets 401. |
| `DATABASE_URL` | Build time | Lets `prisma generate` read the schema. Not used at runtime. |
| `UPLOAD_MAX_BYTES` | Runtime, optional | Max upload size in bytes. Default 5 MB. |
| `PUBLISH_MAX_BYTES` | Runtime, optional | Max publish request size in bytes. Default 10 MB. |

On Netlify set these under **Site configuration → Environment variables**.

## Deploying to Netlify

`netlify.toml` builds with `npm run build` on Node 20 and lets Netlify provision its Next.js runtime. After the first deploy, set `PUBLISH_SECRET`, otherwise the Publish button will report that publishing is disabled.

## How publishing works today

Read this before relying on **Publish**.

- **Upload → Parse** is open to anyone (size-limited to 5 MB and rate-limited). It does not change what anyone else sees.
- **Publish** requires the publish key. It stores the timetable in server memory and `/tmp`, and the browser keeps a copy in `localStorage`.
- On Netlify, `/tmp` is **per server instance and not durable**, and there is **no shared database yet**. A publish is therefore reliably visible only in the browser that published it. Other devices may keep seeing the bundled 2025–26 seed.
- `/api/health` reports on this store (`seed` or `upload`), not on a database.

A durable shared store (Netlify Blobs or Postgres) is the next infrastructure step.

## Security notes

- Publish uses a constant-time secret comparison and logs failed attempts (never the submitted value).
- Uploads are capped, rate-limited, and error text is generic in production.
- Responses carry CSP, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a permissions policy and HSTS.
- Student lists are parsed in the browser only and are cleared from `localStorage` after 24 hours.
- Known gap: spreadsheet parsing uses `xlsx` 0.18.5, the last version published to npm, which has known advisories. The upload size cap reduces exposure; replacing the parser is planned.
- The in-memory rate limiter is per server instance. It slows bursts but is not a substitute for edge rate limiting.

## Upload formats

- **Timetable:** one sheet per section *or* a single grid with days as rows. Cells may include `Room No:- 316` / `R.No-404`. Download `/samples/timetable-template.csv`.
- **Students:** columns `Section`, `Roll`, `Name` (flexible headers). Download `/samples/students-template.csv`.

Replace the seed anytime from **Upload → Parse → Publish** (see the publishing notes above).
