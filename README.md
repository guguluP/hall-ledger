# Hall Ledger

Multi-institution classroom availability. Each school has its own rooms, timetable versions, and members. Students open a public link. Editors publish a CSV. Owners invite staff.

The demo school is seeded from the 2025–26 first-year timetable: 16 sections, 340 slots, 27 halls, 35 room overlaps.

## Local setup

```bash
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000. The demo timetable is at `/demo`. The seeded owner is `owner@demo.hallledger.test` / `DemoOwner-2026`. Change that password before sharing a deployment.

Auth is built in: bcrypt passwords, hashed session ids in `__Host-hl_session`, and email links for verification, reset, and invites. Without SMTP, development writes those links to `.mail-dev.log`.

## Upload

Excel: File → Save As → CSV UTF-8. One file per section, or a table with `Section, Day, Start, End, Subject, Room`.

- Tabular template: `/samples/tabular-template.csv`
- Grid template: `/samples/timetable-template.csv`
- 2025–26 export: `/samples/sample-timetable.csv`
- Section counts: `/samples/students-template.csv`

Only section counts are stored. Student names and roll numbers are not.

## Production

Use PostgreSQL, set `APP_URL`, and configure SMTP. See [docs/operations.md](docs/operations.md) for the provider switch, the slot check constraint, and `pg_dump` backups.

Old paths redirect to the demo school: `/timetable` and `/grid` to `/demo/timetable`, `/vacancy` to `/demo/find`.
