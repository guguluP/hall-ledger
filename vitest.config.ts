import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    globalSetup: "./tests/global-setup.ts",
    env: {
      DATABASE_URL: "file:./test.db",
      APP_URL: "http://localhost:3000",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
