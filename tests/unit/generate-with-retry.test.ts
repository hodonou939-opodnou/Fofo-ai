import { afterEach, describe, expect, it, vi } from "vitest";
import { RETRY_BACKOFF_MS, generateWithRetry } from "@/lib/generation/generate-with-retry";
import type {
  GenerationFailureKind,
  GenerationResult,
  MusicGenerationProvider,
} from "@/lib/generation/provider";

const success: GenerationResult = { ok: true, audio: Buffer.from([1]), format: "mp3", sampleRate: 44100 };
const failure = (kind: GenerationFailureKind): GenerationResult => ({ ok: false, kind, detail: kind });

function providerReturning(...results: GenerationResult[]) {
  const generate = vi.fn<MusicGenerationProvider["generate"]>();
  for (const result of results) generate.mockResolvedValueOnce(result);
  return { provider: { name: "fake", generate } satisfies MusicGenerationProvider, generate };
}

const request = { prompt: "p", durationSeconds: 15 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateWithRetry", () => {
  it("returns the first success without retrying", async () => {
    const { provider, generate } = providerReturning(success);
    const sleep = vi.fn(async () => {});

    expect(await generateWithRetry(provider, request, sleep)).toBe(success);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each<GenerationFailureKind>(["timeout", "unavailable"])(
    "retries once after the backoff on a %s failure",
    async (kind) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const { provider, generate } = providerReturning(failure(kind), success);
      const sleep = vi.fn(async () => {});

      expect(await generateWithRetry(provider, request, sleep)).toBe(success);
      expect(generate).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(RETRY_BACKOFF_MS);
    }
  );

  it("gives up after the single retry and returns the second failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const second = failure("unavailable");
    const { provider, generate } = providerReturning(failure("timeout"), second, success);

    expect(await generateWithRetry(provider, request, async () => {})).toBe(second);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it.each<GenerationFailureKind>(["refused", "invalid"])("never retries a %s failure", async (kind) => {
    const { provider, generate } = providerReturning(failure(kind), success);
    const sleep = vi.fn(async () => {});

    expect(await generateWithRetry(provider, request, sleep)).toMatchObject({ ok: false, kind });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("uses a backoff of about 2 seconds", () => {
    expect(RETRY_BACKOFF_MS).toBe(2_000);
  });
});
