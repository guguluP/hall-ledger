import { defineConfig, devices } from "@playwright/test";

// The e2e run writes test users and re-seeds the demo school. Use a throwaway Postgres DB whose name contains "test".
const e2eUrl = process.env.E2E_DATABASE_URL || "";
const e2eDb = e2eUrl.split("?")[0].split("/").pop() || "";
if (!e2eUrl.startsWith("postgres") || !/test/i.test(e2eDb)) {
  throw new Error("Set E2E_DATABASE_URL to a throwaway Postgres database whose name contains 'test'.");
}

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/reset-test-db.mjs E2E_DATABASE_URL && npx tsx prisma/seed.ts && npx next dev -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: e2eUrl,
      DIRECT_URL: e2eUrl,
      E2E_DATABASE_URL: e2eUrl,
      APP_URL: "http://127.0.0.1:3100",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
