import { MockProvider } from "./mock-provider";
import { StableAudioProvider } from "./stable-audio-provider";
import type { MusicGenerationProvider } from "./provider";

// GENERATION_PROVIDER=mock is a test-only opt-in: set it in the shell that
// starts the dev server for the integration suite, and Playwright's webServer
// sets it for the e2e suite. It is ignored on a Vercel production deployment,
// so the mock can never silently stand in for the real provider there.
// Returns null when no real provider is configured: /api/generate then
// answers 503 instead of synthesizing anything.
export function getProvider(): MusicGenerationProvider | null {
  if (process.env.GENERATION_PROVIDER === "mock" && process.env.VERCEL_ENV !== "production") {
    return new MockProvider();
  }
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) return null;
  return new StableAudioProvider(apiKey);
}
