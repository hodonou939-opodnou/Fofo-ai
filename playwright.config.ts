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
  // A dev server rendering pages that each make several round-trips to the
  // remote Supabase project, under parallel workers, can take a few seconds to
  // finish a navigation (measured: /studio avg 1.2 s, max 4.4 s). The default
  // 5 s assertion wait sits right on that edge, so assertions get 15 s — the
  // checks themselves are unchanged.
  expect: { timeout: 15_000 },
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
    // The spec's narrowest target (360 px): small Android phones.
    { name: "small-phone", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
  ],
});
