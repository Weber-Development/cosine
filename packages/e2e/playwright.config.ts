import { defineConfig } from "@playwright/test";

// CI installs Chromium with `playwright install`. Elsewhere set CHROMIUM_PATH.
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:4173",
    launchOptions: { executablePath },
  },
  webServer: {
    command: "node server.mjs",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
