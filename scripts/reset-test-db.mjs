// Wipes and re-migrates a throwaway test database. Refuses any URL whose database
// name doesn't contain "test", so it can never touch Supabase production.
// Usage: node scripts/reset-test-db.mjs <ENV_VAR_NAME>
import { execSync } from "node:child_process";

export function resetTestDb(url) {
  const dbName = (url || "").split("?")[0].split("/").pop() || "";
  if (!url || !url.startsWith("postgres") || !/test/i.test(dbName)) {
    throw new Error(
      "Refusing to reset: use a throwaway Postgres database whose name contains 'test' (for example postgresql://postgres:postgres@localhost:5432/hall_test).",
    );
  }
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execSync("npx prisma db execute --stdin --url \"$DATABASE_URL\"", {
    input: "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    stdio: ["pipe", "inherit", "inherit"],
    env,
  });
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv[2] || "TEST_DATABASE_URL";
  resetTestDb(process.env[name]);
}
