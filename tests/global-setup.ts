import { resetTestDb } from "../scripts/reset-test-db.mjs";

/**
 * Tests delete every row, so they only run against a database whose name
 * contains "test" (TEST_DATABASE_URL). The schema is dropped and re-migrated
 * each run, so leftovers (db push, migrate diff shadow, old runs) can't cause P3005.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL || "";
  const dbName = url.split("?")[0].split("/").pop() || "";
  if (!url.startsWith("postgres") || !/test/i.test(dbName)) {
    throw new Error(
      "Set TEST_DATABASE_URL to a throwaway Postgres database whose name contains 'test' (for example postgresql://postgres:postgres@localhost:5432/hall_test). Tests wipe it.",
    );
  }
  resetTestDb(url);
}
