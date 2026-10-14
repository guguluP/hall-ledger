import { execSync } from "node:child_process";

/**
 * Tests delete every row, so they only run against a database whose name
 * contains "test" (TEST_DATABASE_URL). Never point this at Supabase production.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL || "";
  const dbName = url.split("?")[0].split("/").pop() || "";
  if (!url.startsWith("postgres") || !/test/i.test(dbName)) {
    throw new Error(
      "Set TEST_DATABASE_URL to a throwaway Postgres database whose name contains 'test' (for example postgresql://postgres:postgres@localhost:5432/hall_test). Tests wipe it.",
    );
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
