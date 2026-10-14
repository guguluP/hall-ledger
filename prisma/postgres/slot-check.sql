-- Apply after `prisma migrate` when datasource provider is postgresql.
-- Prisma cannot express this CHECK on SQLite, so it ships as raw SQL.
ALTER TABLE "Slot" DROP CONSTRAINT IF EXISTS "Slot_time_order";
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_time_order" CHECK ("startMin" < "endMin");
