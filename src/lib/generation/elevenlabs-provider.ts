import type {
  GenerationFailureKind,
  GenerationRequest,
  GenerationResult,
  MusicGenerationProvider,
} from "./provider";
import { PROVIDER_ATTEMPT_TIMEOUT_MS } from "./stable-audio-provider";

// ElevenLabs Music API (paid plans only — free accounts get 402 "limited_access").
// Request shape from the official reference (POST /v1/music): prompt,
// music_length_ms (3 000–600 000), model_id (default music_v1), and
// force_instrumental, which guarantees no vocals — Fofo makes instrumentals.
const ENDPOINT = "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128";
const MODEL_ID = "music_v1";
const SAMPLE_RATE = 44_100;

// Refusals ElevenLabs names in detail.status (copyrighted or harmful content).
const REFUSALS = new Set(["bad_prompt", "bad_composition_plan"]);

export class ElevenLabsProvider implements MusicGenerationProvider {
  name = "elevenlabs";

  constructor(private readonly apiKey: string) {}

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          prompt: request.prompt,
          music_length_ms: request.durationSeconds * 1000,
          model_id: MODEL_ID,
          force_instrumental: true,
        }),
        signal: AbortSignal.timeout(PROVIDER_ATTEMPT_TIMEOUT_MS),
      });

      if (!response.ok) {
        const { status, text } = await readError(response);
        return { ok: false, kind: failureKind(response.status, status), detail: text };
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("audio/") && !contentType.startsWith("application/octet-stream")) {
        return { ok: false, kind: "unavailable", detail: `Unexpected content-type "${contentType}"` };
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) {
        return { ok: false, kind: "unavailable", detail: "Empty audio body" };
      }

      return { ok: true, audio: bytes, format: "mp3", sampleRate: SAMPLE_RATE };
    } catch (err) {
      if (isAbortError(err)) {
        return { ok: false, kind: "timeout", detail: `No complete response within ${PROVIDER_ATTEMPT_TIMEOUT_MS} ms` };
      }
      return {
        ok: false,
        kind: "unavailable",
        detail: `Network error contacting ElevenLabs: ${(err as Error)?.message ?? String(err)}`,
      };
    }
  }
}

function failureKind(httpStatus: number, apiStatus: string | null): GenerationFailureKind {
  if (apiStatus && REFUSALS.has(apiStatus)) return "refused";
  // 401 key/permission, 402 no paid plan or credits, 429 rate limit, 5xx outage.
  if (httpStatus >= 500 || httpStatus === 401 || httpStatus === 402 || httpStatus === 429) return "unavailable";
  return "invalid";
}

async function readError(response: Response): Promise<{ status: string | null; text: string }> {
  const prefix = `ElevenLabs HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { detail?: unknown };
    const detail = body?.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const d = detail as { status?: string; message?: string };
      return { status: d.status ?? null, text: `${prefix}: ${[d.status, d.message].filter(Boolean).join(" — ")}` };
    }
    if (Array.isArray(detail)) {
      const messages = detail.map((e) => (e as { msg?: string })?.msg).filter(Boolean);
      return { status: null, text: `${prefix}: ${messages.join("; ")}` };
    }
  } catch {
    // body wasn't JSON (or couldn't be read): the HTTP status is the detail
  }
  return { status: null, text: prefix };
}

function isAbortError(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}
