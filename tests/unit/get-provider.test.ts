import { afterEach, describe, expect, it, vi } from "vitest";
import { getProvider } from "@/lib/generation/get-provider";
import { MockProvider } from "@/lib/generation/mock-provider";
import { StableAudioProvider } from "@/lib/generation/stable-audio-provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

function withEnv(env: { GENERATION_PROVIDER?: string; STABILITY_API_KEY?: string; VERCEL_ENV?: string }) {
  vi.stubEnv("GENERATION_PROVIDER", env.GENERATION_PROVIDER ?? "");
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
