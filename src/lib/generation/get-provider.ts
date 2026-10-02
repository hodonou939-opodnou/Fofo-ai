import { MockProvider } from "./mock-provider";
import { StableAudioProvider } from "./stable-audio-provider";
import type { MusicGenerationProvider } from "./provider";

// GENERATION_PROVIDER=mock is set only in the integration-test environment
// (see tests/integration setup) — never in a deployed environment's config.
export function getProvider(): MusicGenerationProvider | null {
  if (process.env.GENERATION_PROVIDER === "mock") {
    return new MockProvider();
  }
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) return null;
  return new StableAudioProvider(apiKey);
}
