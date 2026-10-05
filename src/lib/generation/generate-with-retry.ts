import type {
  GenerationFailureKind,
  GenerationRequest,
  GenerationResult,
  MusicGenerationProvider,
} from "./provider";

export const RETRY_BACKOFF_MS = 2_000;

// Only transient failures are worth a second paid attempt; a moderation
// refusal or an invalid request would fail the same way again.
const RETRYABLE_KINDS: ReadonlySet<GenerationFailureKind> = new Set(["timeout", "unavailable"]);

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// One retry with backoff, then an explicit failure (spec §4).
export async function generateWithRetry(
  provider: MusicGenerationProvider,
  request: GenerationRequest,
  sleep: (ms: number) => Promise<void> = wait
): Promise<GenerationResult> {
  const first = await provider.generate(request);
  if (first.ok || !RETRYABLE_KINDS.has(first.kind)) return first;

  console.warn(
    `[generation] ${provider.name} attempt 1 failed (${first.kind}): ${first.detail} — retrying once`
  );
  await sleep(RETRY_BACKOFF_MS);
  return provider.generate(request);
}
