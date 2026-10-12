import { defineConfig, devices } from "@playwright/test";

// CI installs the browsers with `playwright install` and sets BROWSERS=all. Elsewhere only
// Chromium runs; set CHROMIUM_PATH to use one that is already installed.
const executablePath = process.env.CHROMIUM_PATH || undefined;
const all = process.env.BROWSERS === "all";

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  use: { baseURL: "http://localhost:4173" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
    ...(all
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ]
      : []),
  ],
  webServer: {
    command: "node server.mjs",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
