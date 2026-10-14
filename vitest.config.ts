import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    globalSetup: "./tests/global-setup.ts",
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || "",
      DIRECT_URL: process.env.TEST_DATABASE_URL || "",
      APP_URL: process.env.APP_URL || "http://localhost:3000",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
