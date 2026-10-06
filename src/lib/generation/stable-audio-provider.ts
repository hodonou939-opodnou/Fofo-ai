import type {
  GenerationFailureKind,
  GenerationRequest,
  GenerationResult,
  MusicGenerationProvider,
} from "./provider";

const ENDPOINT = "https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio";

// Upper bound for one provider attempt, response body included. Two attempts
// plus the retry backoff must fit in the generate route's maxDuration (120 s)
// with room left for the storage upload.
export const PROVIDER_ATTEMPT_TIMEOUT_MS = 45_000;

export class StableAudioProvider implements MusicGenerationProvider {
  name = "stable-audio";

  constructor(private readonly apiKey: string) {}

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const form = new FormData();
    form.set("prompt", request.prompt);
    form.set("duration", String(request.durationSeconds));
    form.set("model", "stable-audio-2.5");
    form.set("output_format", "mp3");

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          accept: "audio/*",
        },
        body: form,
        signal: AbortSignal.timeout(PROVIDER_ATTEMPT_TIMEOUT_MS),
      });

      if (!response.ok) {
        return {
          ok: false,
          kind: failureKindForStatus(response.status),
          detail: await readErrorDetail(response),
        };
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("audio/")) {
        return { ok: false, kind: "unavailable", detail: `Unexpected content-type "${contentType}"` };
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) {
        return { ok: false, kind: "unavailable", detail: "Empty audio body" };
      }

      return { ok: true, audio: bytes, format: "mp3", sampleRate: 44100 };
    } catch (err) {
      if (isAbortError(err)) {
        return {
          ok: false,
          kind: "timeout",
          detail: `No complete response within ${PROVIDER_ATTEMPT_TIMEOUT_MS} ms`,
        };
      }
      return {
        ok: false,
        kind: "unavailable",
        detail: `Network error contacting Stable Audio: ${(err as Error)?.message ?? String(err)}`,
      };
    }
  }
}

function failureKindForStatus(status: number): GenerationFailureKind {
  if (status === 403) return "refused"; // content moderation
  // 402: the account is out of credits — our problem, not the user's request.
  if (status >= 500 || status === 401 || status === 402 || status === 429) return "unavailable";
  return "invalid";
}

async function readErrorDetail(response: Response): Promise<string> {
  const status = `Stable Audio HTTP ${response.status}`;
  try {
    const body = await response.json();
    if (Array.isArray(body?.errors)) return `${status}: ${body.errors.join(", ")}`;
  } catch {
    // body wasn't JSON (or couldn't be read): the HTTP status is the detail
  }
  return status;
}

function isAbortError(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}
