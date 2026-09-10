# Hall Ledger

**Smart classroom availability & section management** — Aryabhatta & Kautalya, 1st year 2025–26.

A mobile-first web app that finds free halls, flags room overlaps, and proposes section merges.

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

- Next.js 15 (App Router) + TypeScript + Tailwind
- No database required for Grid / Find / Upload (published store + bundled seed)
- Prisma is optional if you later persist to Postgres

## Local setup

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Upload formats

- **Timetable:** one sheet per section *or* a single grid with days as rows. Cells may include `Room No:- 316` / `R.No-404`. Download `/samples/timetable-template.csv`.
- **Students:** columns `Section`, `Roll`, `Name` (flexible headers). Download `/samples/students-template.csv`.

Replace the seed anytime from **Upload → Parse → Publish**.
