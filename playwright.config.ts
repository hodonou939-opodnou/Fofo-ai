import { defineConfig, devices } from "@playwright/test";

// Same override as the integration suite (TEST_BASE_URL), default :3000.
// Next 16 refuses a second `next dev` in the same project directory, so a
// dedicated test-only server can't run next to a developer's dev server: an
// already-running server is reused, and the generating specs refuse to run
// unless that server reports the mock provider (x-generation-provider).
const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const port = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    env: { GENERATION_PROVIDER: "mock" },
    timeout: 60_000,
  },
  use: { baseURL },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
