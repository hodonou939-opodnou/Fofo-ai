import { enforcePlan, type Composition, type CompositionPlan } from "./composition-plan";
import type {
  GenerationFailureKind,
  GenerationRequest,
  GenerationResult,
  MusicGenerationProvider,
} from "./provider";
import { PROVIDER_ATTEMPT_TIMEOUT_MS } from "./stable-audio-provider";

// ElevenLabs Music API (paid plans only — free accounts get 402 "limited_access").
// With a composition, POST /v1/music takes a composition_plan (never with a
// prompt; music_v2/v2_5 "chunks"). Without one, it takes a prompt,
// music_length_ms (3 000–600 000) and force_instrumental, which only works
// with a prompt — a plan stays instrumental through its negative styles.
// music_v1 is deprecated and removed on 2027-01-31.
const ENDPOINT = "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128";
const MODEL_ID = "music_v2_5";
const SAMPLE_RATE = 44_100;

// The planner (POST /v1/music/plan) costs no credits. Given Fofo's skeleton as
// source_composition_plan, it keeps the rhythm and weaves in the user's idea
// (observed ~3.3 s). Bounded short so a slow planner leaves the attempt time
// to compose the skeleton instead.
const PLAN_ENDPOINT = "https://api.elevenlabs.io/v1/music/plan";
export const PLAN_TIMEOUT_MS = 10_000;

// Refusals ElevenLabs names in detail.status (copyrighted or harmful content).
const REFUSALS = new Set(["bad_prompt", "bad_composition_plan"]);

export class ElevenLabsProvider implements MusicGenerationProvider {
  name = "elevenlabs";

  constructor(private readonly apiKey: string) {}

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const attempt = AbortSignal.timeout(PROVIDER_ATTEMPT_TIMEOUT_MS);
    try {
      let body: Record<string, unknown>;
      if (request.composition) {
        const planned = await this.plan(request.composition, request.durationSeconds, attempt);
        if (!planned.ok) return planned;
        body = { composition_plan: planned.plan, model_id: MODEL_ID };
      } else {
        body = {
          prompt: request.prompt,
          music_length_ms: request.durationSeconds * 1000,
          model_id: MODEL_ID,
          force_instrumental: true,
        };
      }

      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify(body),
        signal: attempt,
      });

      if (!response.ok) {
        const { status, type, text } = await readError(response);
        return { ok: false, kind: failureKind(response.status, status, type), detail: text };
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

  // Fits the user's idea into the skeleton. A refusal of the idea (e.g. a named
  // artist) is the user's to fix; any other planner failure only costs the idea,
  // so the skeleton is composed as is. Throws only when the attempt itself ran
  // out, which generate() reports as a timeout.
  private async plan(
    composition: Composition,
    durationSeconds: number,
    attempt: AbortSignal
  ): Promise<{ ok: true; plan: CompositionPlan } | { ok: false; kind: GenerationFailureKind; detail: string }> {
    const { skeleton, idea } = composition;
    try {
      const response = await fetch(PLAN_ENDPOINT, {
        method: "POST",
        headers: { "xi-api-key": this.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          prompt: idea,
          music_length_ms: durationSeconds * 1000,
          model_id: MODEL_ID,
          source_composition_plan: skeleton,
        }),
        signal: AbortSignal.any([attempt, AbortSignal.timeout(PLAN_TIMEOUT_MS)]),
      });
      if (!response.ok) {
        const { status, text } = await readError(response);
        if (status && REFUSALS.has(status)) return { ok: false, kind: "refused", detail: `Planner: ${text}` };
        console.warn(`[elevenlabs] planner failed, composing Fofo's skeleton: ${text}`);
        return { ok: true, plan: skeleton };
      }
      return { ok: true, plan: enforcePlan(skeleton, await response.json()) };
    } catch (err) {
      if (attempt.aborted) throw err;
      console.warn(`[elevenlabs] planner failed, composing Fofo's skeleton: ${(err as Error)?.message ?? String(err)}`);
      return { ok: true, plan: skeleton };
    }
  }
}

function failureKind(httpStatus: number, apiStatus: string | null, apiType: string | null): GenerationFailureKind {
  if (apiStatus && REFUSALS.has(apiStatus)) return "refused";
  // A bad or under-permissioned key can come back as HTTP 400 (seen in
  // production) — still our configuration problem, never the user's request.
  if (apiType === "authentication_error") return "unavailable";
  // 401 key/permission, 402 no paid plan or credits, 429 rate limit, 5xx outage.
  if (httpStatus >= 500 || httpStatus === 401 || httpStatus === 402 || httpStatus === 429) return "unavailable";
  return "invalid";
}

async function readError(response: Response): Promise<{ status: string | null; type: string | null; text: string }> {
  const prefix = `ElevenLabs HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { detail?: unknown };
    const detail = body?.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const d = detail as { status?: string; type?: string; message?: string };
      return { status: d.status ?? null, type: d.type ?? null, text: `${prefix}: ${[d.status, d.message].filter(Boolean).join(" — ")}` };
    }
    if (Array.isArray(detail)) {
      const messages = detail.map((e) => (e as { msg?: string })?.msg).filter(Boolean);
      return { status: null, type: null, text: `${prefix}: ${messages.join("; ")}` };
    }
  } catch {
    // body wasn't JSON (or couldn't be read): the HTTP status is the detail
  }
  return { status: null, type: null, text: prefix };
}

function isAbortError(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}
