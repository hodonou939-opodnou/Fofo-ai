import { afterEach, describe, expect, it, vi } from "vitest";
import { getProvider } from "@/lib/generation/get-provider";
import { MockProvider } from "@/lib/generation/mock-provider";
import { StableAudioProvider } from "@/lib/generation/stable-audio-provider";
import { ElevenLabsProvider } from "@/lib/generation/elevenlabs-provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

function withEnv(env: {
  GENERATION_PROVIDER?: string;
  STABILITY_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  VERCEL_ENV?: string;
}) {
  vi.stubEnv("GENERATION_PROVIDER", env.GENERATION_PROVIDER ?? "");
  // Always stubbed (empty when absent) so a real key in .env.local can't leak in.
  vi.stubEnv("ELEVENLABS_API_KEY", env.ELEVENLABS_API_KEY ?? "");
  vi.stubEnv("STABILITY_API_KEY", env.STABILITY_API_KEY ?? "");
  vi.stubEnv("VERCEL_ENV", env.VERCEL_ENV ?? "");
}

describe("getProvider", () => {
  it("returns null when nothing is configured (the route answers 503, never a silent mock)", () => {
    withEnv({});
    expect(getProvider()).toBeNull();
  });

  it("returns the real provider when an API key is set", () => {
    withEnv({ STABILITY_API_KEY: "sk-test" });
    expect(getProvider()).toBeInstanceOf(StableAudioProvider);
  });

  it("returns the mock only on explicit opt-in outside production", () => {
    withEnv({ GENERATION_PROVIDER: "mock", STABILITY_API_KEY: "sk-test" });
    expect(getProvider()).toBeInstanceOf(MockProvider);
  });

  it("allows the mock on a Vercel preview deployment", () => {
    withEnv({ GENERATION_PROVIDER: "mock", VERCEL_ENV: "preview" });
    expect(getProvider()).toBeInstanceOf(MockProvider);
  });

  it("ignores GENERATION_PROVIDER=mock in Vercel production and uses the real provider", () => {
    withEnv({ GENERATION_PROVIDER: "mock", STABILITY_API_KEY: "sk-test", VERCEL_ENV: "production" });
    expect(getProvider()).toBeInstanceOf(StableAudioProvider);
  });

  it("ignores GENERATION_PROVIDER=mock in Vercel production and reports not configured without a key", () => {
    withEnv({ GENERATION_PROVIDER: "mock", VERCEL_ENV: "production" });
    expect(getProvider()).toBeNull();
  });
});

describe("getProvider — ElevenLabs", () => {
  it("prefers ElevenLabs when its key is set", () => {
    withEnv({ ELEVENLABS_API_KEY: "sk_el", STABILITY_API_KEY: "sk-test" });
    expect(getProvider()).toBeInstanceOf(ElevenLabsProvider);
  });

  it("uses ElevenLabs alone when it is the only key", () => {
    withEnv({ ELEVENLABS_API_KEY: "sk_el" });
    expect(getProvider()).toBeInstanceOf(ElevenLabsProvider);
  });

  it("falls back to Stability when no ElevenLabs key is set", () => {
    withEnv({ STABILITY_API_KEY: "sk-test" });
    expect(getProvider()).toBeInstanceOf(StableAudioProvider);
  });

  it("still lets the test mock win outside production", () => {
    withEnv({ GENERATION_PROVIDER: "mock", ELEVENLABS_API_KEY: "sk_el" });
    expect(getProvider()).toBeInstanceOf(MockProvider);
  });

  it("never uses the mock in Vercel production, even with ElevenLabs configured", () => {
    withEnv({ GENERATION_PROVIDER: "mock", ELEVENLABS_API_KEY: "sk_el", VERCEL_ENV: "production" });
    expect(getProvider()).toBeInstanceOf(ElevenLabsProvider);
  });
});
