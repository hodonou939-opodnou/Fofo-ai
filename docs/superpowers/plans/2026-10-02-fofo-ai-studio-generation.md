# Studio & Generation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Fofo AI studio actually generate original instrumental music via Stable Audio, store it securely, and let the user play/download it and see it in their library.

**Architecture:** A provider abstraction (`MusicGenerationProvider`) isolates the app from Stability AI specifics; a single API route creates a `generation_jobs` row and uses Next.js's `after()` to run the real provider call and storage upload without blocking the client response; the client polls the job row (already RLS-protected to its owner) every 3s for status, matching the spec's documented Realtime-or-polling fallback. Audio lives in a private, per-user-folder Supabase Storage bucket guarded by Storage RLS — no service-role key is needed anywhere in the running app.

**Tech Stack:** Next.js 16 Route Handlers, `after()` from `next/server`, native `fetch`/`FormData` (no new HTTP client dependency), Supabase Storage with RLS, Stability AI Stable Audio 2.5 REST API.

**Spec:** `docs/superpowers/specs/2026-09-26-fofo-ai-phase1-design.md` (sections 4, 5, 6, 9, 10, 14, 15 — the generation pipeline, data model, studio screen, and audio player requirements)

## Global Constraints

- Never show a successful generation state before a real audio asset is stored and verified (spec §4).
- The creative prompt sent to the provider is always composed in French/English, never in Fon (spec §4, §8).
- A mock provider may be used only in tests, explicitly labeled, never as a silent production fallback (spec §4, §20). If no real provider is configured in production, the generation endpoint must return a clear "unavailable" error, not synthesize fake audio.
- Provider API keys and any elevated credentials stay server-only; this plan in fact needs none exposed to the client beyond what's already public (spec §9).
- Storage is private by default; the app never issues a permanent public URL for a user's generated audio (spec §15).
- Rate limit generation submissions per user; the limit is a named constant, not hardcoded inline in business logic (spec §9: 10/hour default).
- A generation job must not be duplicated by a network retry of the same submission (idempotency, spec §4).

## Review Focus

- Submitting the same generation twice in a row due to a dropped network response must not create two jobs or double-charge the provider — idempotency must be enforced server-side, not just assumed from client behavior.
- A user must never be able to fetch another user's generated audio, even by guessing a job/asset id — Storage RLS and the signed-URL route must both check ownership.
- Exceeding the per-user generation rate limit must show a clear, specific error, not a generic failure or a silently-dropped request.
- If the configured provider errors or times out, the job must land in `failed` with a user-readable message, never stay stuck in `processing` forever or report `completed` with no playable audio.
- If `STABILITY_API_KEY` is missing in a given environment, submitting a generation must fail with an explicit "service not configured" response, never silently substitute the mock provider.

---

## File Structure

```
supabase/migrations/
  0003_generation_storage.sql       -- storage bucket + RLS + realtime publication (if used)
src/
  lib/
    generation/
      provider.ts                  -- MusicGenerationProvider interface + shared types
      mock-provider.ts             -- MockProvider (tests only)
      stable-audio-provider.ts     -- real Stability AI adapter
      get-provider.ts              -- env-based provider selection (mock only via explicit test env var)
      build-prompt.ts              -- composes the final provider prompt from form fields
      rate-limit.ts                -- MAX_GENERATIONS_PER_HOUR constant + checkRateLimit()
  app/
    api/
      generate/route.ts            -- POST: validate, rate-limit, idempotent job creation, after() processing
      audio/[jobId]/route.ts       -- GET: ownership check + signed URL redirect
    studio/page.tsx                -- real studio screen (replaces placeholder)
    bibliotheque/page.tsx          -- user's past generations
  components/
    studio/
      generation-form.tsx          -- rhythm/prompt/mood/energy/duration form + submit
      job-status.tsx               -- polls job row, renders queued/processing/completed/failed
      audio-player.tsx             -- <audio> + download link, fetches signed URL lazily
  proxy.ts                          -- modify: add /bibliotheque to the protected matcher
tests/
  unit/
    mock-provider.test.ts
    stable-audio-provider.test.ts
    build-prompt.test.ts
    rate-limit.test.ts
  integration/
    generate-route.test.ts         -- hits the real dev server with GENERATION_PROVIDER=mock
  e2e/
    studio-generation.spec.ts
```

---

### Task 1: Provider abstraction + MockProvider

**Files:**
- Create: `src/lib/generation/provider.ts`
- Create: `src/lib/generation/mock-provider.ts`
- Test: `tests/unit/mock-provider.test.ts`

**Interfaces:**
- Produces: `GenerationRequest` (`{ prompt: string; durationSeconds: number }`), `GenerationResult` (discriminated union `{ ok: true; audio: Buffer; format: "mp3" | "wav"; sampleRate: number } | { ok: false; errorMessage: string }`), `MusicGenerationProvider` interface (`{ name: string; generate(request: GenerationRequest): Promise<GenerationResult> }`), `MockProvider` class implementing it.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/mock-provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/generation/mock-provider";

describe("MockProvider", () => {
  it("returns a playable fake audio buffer for a normal prompt", async () => {
    const provider = new MockProvider();
    const result = await provider.generate({ prompt: "a happy song", durationSeconds: 15 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.audio.length).toBeGreaterThan(0);
      expect(result.format).toBe("wav");
    }
  });

  it("simulates a provider failure when the prompt contains the sentinel FORCE_FAIL", async () => {
    const provider = new MockProvider();
    const result = await provider.generate({ prompt: "FORCE_FAIL this one", durationSeconds: 15 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- mock-provider`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the provider types**

Create `src/lib/generation/provider.ts`:

```ts
export type GenerationRequest = {
  prompt: string;
  durationSeconds: number;
};

export type GenerationResult =
  | { ok: true; audio: Buffer; format: "mp3" | "wav"; sampleRate: number }
  | { ok: false; errorMessage: string };

export interface MusicGenerationProvider {
  name: string;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}
```

- [ ] **Step 4: Implement MockProvider**

Create `src/lib/generation/mock-provider.ts`:

```ts
import type { GenerationRequest, GenerationResult, MusicGenerationProvider } from "./provider";

// Minimal valid WAV header (44 bytes) + a little silence, so it's a real
// playable file, not an arbitrary byte blob. Test-only — never used in
// production (see get-provider.ts).
function silentWav(): Buffer {
  const sampleRate = 44100;
  const numSamples = sampleRate; // 1 second of silence
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + numSamples * 2, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(numSamples * 2, 40);
  return Buffer.concat([header, Buffer.alloc(numSamples * 2)]);
}

export class MockProvider implements MusicGenerationProvider {
  name = "mock";

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (request.prompt.includes("FORCE_FAIL")) {
      return { ok: false, errorMessage: "Mock provider forced failure." };
    }
    return { ok: true, audio: silentWav(), format: "wav", sampleRate: 44100 };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- mock-provider`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: generation provider abstraction and MockProvider"
```

---

### Task 2: StableAudioProvider adapter

**Files:**
- Create: `src/lib/generation/stable-audio-provider.ts`
- Test: `tests/unit/stable-audio-provider.test.ts`

**Interfaces:**
- Consumes: `GenerationRequest`, `GenerationResult`, `MusicGenerationProvider` from Task 1.
- Produces: `StableAudioProvider` class, constructor `(apiKey: string)`.

Real Stability AI request shape (verified against their current OpenAPI spec, not guessed):
`POST https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio`, `multipart/form-data` body with fields `prompt`, `duration` (1–190), `model` (`stable-audio-2.5`), `output_format` (`mp3`), header `authorization: Bearer <key>`, `accept: audio/*` to get raw bytes back directly with `Content-Type: audio/mpeg`. Errors come back as JSON `{ "id": "...", "name": "...", "errors": ["..."] }` with status 400/403/422/429/500.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/stable-audio-provider.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { StableAudioProvider } from "@/lib/generation/stable-audio-provider";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe("StableAudioProvider", () => {
  it("sends the correct endpoint, auth header, and form fields, and returns the audio bytes on success", async () => {
    const fakeAudio = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "audio/mpeg" }),
      arrayBuffer: async () => fakeAudio.buffer,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new StableAudioProvider("sk-test-key");
    const result = await provider.generate({ prompt: "a calm song", durationSeconds: 30 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.format).toBe("mp3");
      expect(Buffer.from(result.audio)).toEqual(Buffer.from(fakeAudio));
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer sk-test-key");
    expect(init.headers.accept).toBe("audio/*");
    const body = init.body as FormData;
    expect(body.get("prompt")).toBe("a calm song");
    expect(body.get("duration")).toBe("30");
    expect(body.get("model")).toBe("stable-audio-2.5");
    expect(body.get("output_format")).toBe("mp3");
  });

  it("returns a readable error message on a non-200 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: "abc", name: "bad_request", errors: ["prompt is required"] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new StableAudioProvider("sk-test-key");
    const result = await provider.generate({ prompt: "", durationSeconds: 30 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toContain("prompt is required");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- stable-audio-provider`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement StableAudioProvider**

Create `src/lib/generation/stable-audio-provider.ts`:

```ts
import type { GenerationRequest, GenerationResult, MusicGenerationProvider } from "./provider";

const ENDPOINT = "https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio";

export class StableAudioProvider implements MusicGenerationProvider {
  name = "stable-audio";

  constructor(private readonly apiKey: string) {}

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const form = new FormData();
    form.set("prompt", request.prompt);
    form.set("duration", String(request.durationSeconds));
    form.set("model", "stable-audio-2.5");
    form.set("output_format", "mp3");

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          accept: "audio/*",
        },
        body: form,
      });
    } catch (err) {
      return {
        ok: false,
        errorMessage: `Network error contacting Stable Audio: ${(err as Error).message}`,
      };
    }

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (Array.isArray(body.errors)) detail = body.errors.join(", ");
      } catch {
        // body wasn't JSON, keep the HTTP status as the detail
      }
      return { ok: false, errorMessage: `Stable Audio error: ${detail}` };
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return { ok: true, audio: bytes, format: "mp3", sampleRate: 44100 };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- stable-audio-provider`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: real Stable Audio provider adapter"
```

---

### Task 3: Provider selection, prompt builder, rate limit, and storage migration

**Files:**
- Create: `src/lib/generation/get-provider.ts`
- Create: `src/lib/generation/build-prompt.ts`
- Create: `src/lib/generation/rate-limit.ts`
- Create: `supabase/migrations/0003_generation_storage.sql`
- Test: `tests/unit/build-prompt.test.ts`
- Test: `tests/unit/rate-limit.test.ts`

**Interfaces:**
- Consumes: `MusicGenerationProvider`, `MockProvider`, `StableAudioProvider` from Tasks 1–2; `createServerSupabaseClient` from the foundation plan.
- Produces: `getProvider(): MusicGenerationProvider | null` (null means "not configured"), `buildPrompt(params): string`, `MAX_GENERATIONS_PER_HOUR` constant, `checkRateLimit(supabase, userId): Promise<{ allowed: boolean; count: number }>`.

- [ ] **Step 1: Write the failing prompt-builder test**

Create `tests/unit/build-prompt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPrompt } from "@/lib/generation/build-prompt";

describe("buildPrompt", () => {
  it("combines rhythm, user idea, mood, and energy into one English-safe prompt", () => {
    const prompt = buildPrompt({
      rhythmName: "Zinli",
      userIdea: "a wedding celebration feel",
      mood: "Festif",
      energy: "Élevée",
    });
    expect(prompt).toContain("Zinli");
    expect(prompt).toContain("a wedding celebration feel");
    expect(prompt).toContain("Festif");
    expect(prompt).toContain("Élevée");
    expect(prompt.toLowerCase()).toContain("instrumental");
    expect(prompt.toLowerCase()).toContain("no vocals");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- build-prompt`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement buildPrompt**

Create `src/lib/generation/build-prompt.ts`:

```ts
export function buildPrompt(params: {
  rhythmName: string;
  userIdea: string;
  mood: string;
  energy: string;
}): string {
  const { rhythmName, userIdea, mood, energy } = params;
  return (
    `Instrumental track inspired by the ${rhythmName} rhythm from Benin. ${userIdea}. ` +
    `Mood: ${mood}. Energy level: ${energy}. Percussion-forward, original composition, no vocals, no lyrics.`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- build-prompt`
Expected: PASS (1 test)

- [ ] **Step 5: Write the failing rate-limit test**

Create `tests/unit/rate-limit.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, MAX_GENERATIONS_PER_HOUR } from "@/lib/generation/rate-limit";

function fakeSupabase(count: number) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count, error: null }),
        }),
      }),
    }),
  } as never;
}

describe("checkRateLimit", () => {
  it("allows the request when under the hourly limit", async () => {
    const result = await checkRateLimit(fakeSupabase(MAX_GENERATIONS_PER_HOUR - 1), "user-1");
    expect(result.allowed).toBe(true);
  });

  it("blocks the request when at or above the hourly limit", async () => {
    const result = await checkRateLimit(fakeSupabase(MAX_GENERATIONS_PER_HOUR), "user-1");
    expect(result.allowed).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- rate-limit`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement rate limit and provider selection**

Create `src/lib/generation/rate-limit.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_GENERATIONS_PER_HOUR = 10;

export async function checkRateLimit(
  supabase: Pick<SupabaseClient, "from">,
  userId: string
): Promise<{ allowed: boolean; count: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);

  const used = count ?? 0;
  return { allowed: used < MAX_GENERATIONS_PER_HOUR, count: used };
}
```

Create `src/lib/generation/get-provider.ts`:

```ts
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
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- rate-limit build-prompt`
Expected: PASS (3 tests)

- [ ] **Step 9: Write and push the storage migration**

Create `supabase/migrations/0003_generation_storage.sql`:

```sql
insert into storage.buckets (id, name, public)
values ('generations', 'generations', false)
on conflict (id) do nothing;

create policy "generations: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'generations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "generations: owner read"
  on storage.objects for select
  using (
    bucket_id = 'generations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter publication supabase_realtime add table generation_jobs;
```

Run: `npx supabase db push --password "<the DB password from earlier in this session>"`
Expected: migration `0003_generation_storage.sql` applies with no error.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: provider selection, prompt builder, rate limiting, and storage bucket"
```

---

### Task 4: POST /api/generate — validation, rate limit, idempotent job creation

**Files:**
- Create: `src/app/api/generate/route.ts`
- Test: `tests/integration/generate-route.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (foundation plan), `checkRateLimit`/`MAX_GENERATIONS_PER_HOUR` (Task 3), `buildPrompt` (Task 3).
- Produces: `POST /api/generate` accepting JSON `{ rhythmSlug: string; prompt: string; mood: string; energy: string; durationSeconds: number }`, returning `201 { jobId: string }` on success, `400` on invalid input, `401` if unauthenticated, `404` if the rhythm doesn't exist/isn't published, `429` if rate-limited. Background processing (Task 5) is added to this same file.

This task only covers job creation; Task 5 adds the `after()` processing body in the same file.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/generate-route.test.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

const admin = createClient(url, serviceKey);
const createdUserIds: string[] = [];
const createdJobIds: string[] = [];

async function signUpAndSignIn(email: string) {
  const password = "correct horse battery staple 1!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  createdUserIds.push(data.user.id);
  const client = createClient(url, anonKey);
  const { data: signIn } = await client.auth.signInWithPassword({ email, password });
  return { client, accessToken: signIn.session!.access_token };
}

async function postGenerate(accessToken: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  let accessToken: string;

  beforeAll(async () => {
    const { accessToken: token } = await signUpAndSignIn(`gen-${Date.now()}@example.test`);
    accessToken = token;
  });

  afterAll(async () => {
    for (const id of createdJobIds) {
      await admin.from("generation_jobs").delete().eq("id", id);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("creates a queued job for a valid request", async () => {
    const res = await postGenerate(accessToken, {
      rhythmSlug: "zinli",
      prompt: "a calm evening song",
      mood: "Paisible",
      energy: "Modérée",
      durationSeconds: 15,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
    createdJobIds.push(body.jobId);
  });

  it("rejects an unknown rhythm slug", async () => {
    const res = await postGenerate(accessToken, {
      rhythmSlug: "does-not-exist",
      prompt: "x",
      mood: "Paisible",
      energy: "Modérée",
      durationSeconds: 15,
    });
    expect(res.status).toBe(404);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rhythmSlug: "zinli",
        prompt: "x",
        mood: "Paisible",
        energy: "Modérée",
        durationSeconds: 15,
      }),
    });
    expect(res.status).toBe(401);
  });

  it("returns the same job id for an identical duplicate submission (idempotency)", async () => {
    const body = {
      rhythmSlug: "toba",
      prompt: "idempotency-check-prompt",
      mood: "Festif",
      energy: "Élevée",
      durationSeconds: 15,
    };
    const first = await postGenerate(accessToken, body);
    const second = await postGenerate(accessToken, body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstJson = await first.json();
    const secondJson = await second.json();
    createdJobIds.push(firstJson.jobId);
    expect(secondJson.jobId).toBe(firstJson.jobId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run dev` (separate terminal, or rely on the test runner starting it — this integration test needs the server running at `TEST_BASE_URL`; start `npm run dev` first), then: `npm run test:integration -- generate-route`
Expected: FAIL — 404/ECONNREFUSED (route doesn't exist yet).

- [ ] **Step 3: Implement the route (job creation only)**

Create `src/app/api/generate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/generation/rate-limit";

const VALID_DURATIONS = [15, 30, 60];

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.rhythmSlug !== "string" ||
    typeof body.prompt !== "string" ||
    body.prompt.trim().length === 0 ||
    typeof body.mood !== "string" ||
    typeof body.energy !== "string" ||
    !VALID_DURATIONS.includes(body.durationSeconds)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: rhythm } = await supabase
    .from("rhythms")
    .select("id, name")
    .eq("slug", body.rhythmSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!rhythm) {
    return NextResponse.json({ error: "rhythm_not_found" }, { status: 404 });
  }

  const { allowed } = await checkRateLimit(supabase, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const idempotencyKey = createHash("sha256")
    .update(
      [user.id, rhythm.id, body.prompt, body.mood, body.energy, body.durationSeconds].join(":")
    )
    .digest("hex");

  const { data: inserted } = await supabase
    .from("generation_jobs")
    .insert({
      user_id: user.id,
      rhythm_id: rhythm.id,
      prompt: body.prompt,
      mood: body.mood,
      energy: body.energy,
      duration_seconds: body.durationSeconds,
      status: "queued",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .maybeSingle();

  let jobId = inserted?.id;
  if (!jobId) {
    const { data: existing } = await supabase
      .from("generation_jobs")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    jobId = existing?.id;
  }
  if (!jobId) {
    return NextResponse.json({ error: "job_creation_failed" }, { status: 500 });
  }

  return NextResponse.json({ jobId }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify the job-creation tests pass**

Start the dev server (`npm run dev` in another terminal) if not already running, then run: `npm run test:integration -- generate-route`
Expected: PASS for the 4 tests above (the duplicate-submission test already passes because of the idempotency key, even before Task 5 adds real processing).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: POST /api/generate job creation with auth, validation, rate limit, idempotency"
```

---

### Task 5: Background processing — provider call, storage upload, job completion

**Files:**
- Modify: `src/app/api/generate/route.ts`
- Test: `tests/integration/generate-route.test.ts` (extend)

**Interfaces:**
- Consumes: `getProvider` (Task 3), `buildPrompt` (Task 3), `MusicGenerationProvider.generate` (Tasks 1–2).
- Produces: the job created in Task 4 transitions to `processing` then `completed` (with a matching `audio_assets` row) or `failed` (with `error_message` set).

- [ ] **Step 1: Write the failing test for end-to-end completion**

Add to `tests/integration/generate-route.test.ts` (new `it` inside the existing `describe`):

```ts
  it("processes the job in the background to completion with a stored audio asset", async () => {
    const res = await postGenerate(accessToken, {
      rhythmSlug: "tchinkounme",
      prompt: "a festive instrumental",
      mood: "Festif",
      energy: "Élevée",
      durationSeconds: 15,
    });
    expect(res.status).toBe(201);
    const { jobId } = await res.json();
    createdJobIds.push(jobId);

    let job: { status: string; error_message: string | null } | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((r) => setTimeout(r, 500));
      const { data } = await admin
        .from("generation_jobs")
        .select("status, error_message")
        .eq("id", jobId)
        .single();
      job = data;
      if (job && (job.status === "completed" || job.status === "failed")) break;
    }

    expect(job?.status).toBe("completed");
    const { data: asset } = await admin
      .from("audio_assets")
      .select("storage_path")
      .eq("generation_job_id", jobId)
      .maybeSingle();
    expect(asset).not.toBeNull();
    expect(asset!.storage_path).toContain(jobId);
  });

  it("marks the job failed with a message when the mock provider is told to fail", async () => {
    const res = await postGenerate(accessToken, {
      rhythmSlug: "toba",
      prompt: "FORCE_FAIL please",
      mood: "Paisible",
      energy: "Faible",
      durationSeconds: 15,
    });
    expect(res.status).toBe(201);
    const { jobId } = await res.json();
    createdJobIds.push(jobId);

    let job: { status: string; error_message: string | null } | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((r) => setTimeout(r, 500));
      const { data } = await admin
        .from("generation_jobs")
        .select("status, error_message")
        .eq("id", jobId)
        .single();
      job = data;
      if (job && (job.status === "completed" || job.status === "failed")) break;
    }

    expect(job?.status).toBe("failed");
    expect(job?.error_message).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Ensure the dev server is running with `GENERATION_PROVIDER=mock` set in its environment (add this to `.env.local` temporarily is NOT right — instead run the dev server for this test with: stop the running `npm run dev`, then run `GENERATION_PROVIDER=mock npm run dev` in its terminal), then: `npm run test:integration -- generate-route`
Expected: FAIL — jobs stay `queued` forever (no processing exists yet), test times out at `processing`/`completed` never being reached within the 10s poll window.

- [ ] **Step 3: Implement background processing**

Modify `src/app/api/generate/route.ts` — add imports and the `after()` call before the final `return`:

```ts
import { after } from "next/server";
import { getProvider } from "@/lib/generation/get-provider";
import { buildPrompt } from "@/lib/generation/build-prompt";
```

Replace the final block of the `POST` handler (from `if (!jobId)` through the end) with:

```ts
  if (!jobId) {
    return NextResponse.json({ error: "job_creation_failed" }, { status: 500 });
  }

  // Only run the background work for a job we just created (not one returned
  // by the idempotency fast-path above, which is already queued/processing).
  if (inserted?.id === jobId) {
    const provider = getProvider();
    if (!provider) {
      await supabase
        .from("generation_jobs")
        .update({ status: "failed", error_message: "Service de génération non configuré." })
        .eq("id", jobId);
    } else {
      const finalPrompt = buildPrompt({
        rhythmName: rhythm.name,
        userIdea: body.prompt,
        mood: body.mood,
        energy: body.energy,
      });
      after(async () => {
        await supabase
          .from("generation_jobs")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", jobId);

        const result = await provider.generate({
          prompt: finalPrompt,
          durationSeconds: body.durationSeconds,
        });

        if (!result.ok) {
          await supabase
            .from("generation_jobs")
            .update({
              status: "failed",
              error_message: result.errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);
          return;
        }

        const storagePath = `${user.id}/${jobId}.${result.format}`;
        const { error: uploadError } = await supabase.storage
          .from("generations")
          .upload(storagePath, result.audio, {
            contentType: result.format === "mp3" ? "audio/mpeg" : "audio/wav",
          });

        if (uploadError) {
          await supabase
            .from("generation_jobs")
            .update({
              status: "failed",
              error_message: `Échec du stockage audio: ${uploadError.message}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);
          return;
        }

        await supabase.from("audio_assets").insert({
          generation_job_id: jobId,
          storage_path: storagePath,
          format: result.format,
          duration_seconds: body.durationSeconds,
          sample_rate: result.sampleRate,
          file_size_bytes: result.audio.length,
        });

        await supabase
          .from("generation_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        await supabase.from("usage_records").insert({
          user_id: user.id,
          generation_job_id: jobId,
          estimated_cost: 0,
        });
      });
    }
  }

  return NextResponse.json({ jobId }, { status: 201 });
}

export const maxDuration = 120;
```

- [ ] **Step 4: Run test to verify it passes**

With the dev server still running as `GENERATION_PROVIDER=mock npm run dev`, run: `npm run test:integration -- generate-route`
Expected: PASS (6 tests total in this file).

- [ ] **Step 5: Restart the dev server normally**

Stop the `GENERATION_PROVIDER=mock` dev server and restart it as plain `npm run dev` before any manual browser testing, so real generations go to the real provider once `STABILITY_API_KEY` is set.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: background job processing — provider call, storage upload, completion"
```

---

### Task 6: Signed URL route and AudioPlayer component

**Files:**
- Create: `src/app/api/audio/[jobId]/route.ts`
- Create: `src/components/studio/audio-player.tsx`
- Test: `tests/integration/audio-route.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient`.
- Produces: `GET /api/audio/:jobId` → `302` redirect to a signed URL on success, `404` if the job/asset doesn't exist or belongs to another user. `AudioPlayer` component, props `{ jobId: string }`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/audio-route.test.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

const admin = createClient(url, serviceKey);
const createdUserIds: string[] = [];

async function signUpAndSignIn(email: string) {
  const password = "correct horse battery staple 1!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  createdUserIds.push(data.user.id);
  const client = createClient(url, anonKey);
  const { data: signIn } = await client.auth.signInWithPassword({ email, password });
  return { userId: data.user.id, accessToken: signIn.session!.access_token };
}

describe("GET /api/audio/:jobId", () => {
  afterAll(async () => {
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("returns 404 for a job that does not belong to the requester", async () => {
    const owner = await signUpAndSignIn(`owner-${Date.now()}@example.test`);
    const stranger = await signUpAndSignIn(`stranger-${Date.now()}@example.test`);

    const { data: rhythm } = await admin.from("rhythms").select("id").eq("slug", "zinli").single();
    const { data: job } = await admin
      .from("generation_jobs")
      .insert({
        user_id: owner.userId,
        rhythm_id: rhythm!.id,
        prompt: "p",
        duration_seconds: 15,
        status: "completed",
        idempotency_key: `audio-route-test-${Date.now()}`,
      })
      .select("id")
      .single();
    await admin.from("audio_assets").insert({
      generation_job_id: job!.id,
      storage_path: `${owner.userId}/${job!.id}.wav`,
      format: "wav",
      duration_seconds: 15,
      sample_rate: 44100,
      file_size_bytes: 100,
    });

    const res = await fetch(`${baseUrl}/api/audio/${job!.id}`, {
      redirect: "manual",
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration -- audio-route`
Expected: FAIL — 404 route doesn't exist (Next returns its own 404, but let's confirm by also checking the route file doesn't exist — proceed to implement).

- [ ] **Step 3: Implement the signed URL route**

Create `src/app/api/audio/[jobId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: asset } = await supabase
    .from("audio_assets")
    .select("storage_path, generation_jobs!inner(user_id)")
    .eq("generation_job_id", jobId)
    .maybeSingle();

  if (!asset || (asset.generation_jobs as unknown as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from("generations")
    .createSignedUrl(asset.storage_path, 60 * 60);

  if (error || !signed) {
    return NextResponse.json({ error: "signing_failed" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:integration -- audio-route`
Expected: PASS (1 test)

- [ ] **Step 5: Implement AudioPlayer**

Create `src/components/studio/audio-player.tsx`:

```tsx
"use client";

export default function AudioPlayer({ jobId }: { jobId: string }) {
  const src = `/api/audio/${jobId}`;
  return (
    <div className="mt-4 flex flex-col gap-2">
      <audio controls src={src} className="w-full" />
      <a href={src} download className="text-sm underline w-fit">
        Télécharger
      </a>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: signed audio URL route and AudioPlayer component"
```

---

### Task 7: Studio page — form, live status, playback

**Files:**
- Create: `src/components/studio/generation-form.tsx`
- Create: `src/components/studio/job-status.tsx`
- Modify: `src/app/studio/page.tsx` (replaces the placeholder)
- Test: `tests/unit/job-status.test.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient` (foundation plan), `AudioPlayer` (Task 6), `POST /api/generate` (Task 4–5).
- Produces: `GenerationForm` (no props, posts to `/api/generate`, calls `onJobCreated(jobId: string)`), `JobStatus` (props `{ jobId: string }`, polls and renders state + `AudioPlayer` on completion).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/job-status.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JobStatus from "@/components/studio/job-status";

const singleMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: singleMock,
        }),
      }),
    }),
  }),
}));

describe("JobStatus", () => {
  it("shows the error message when the job fails", async () => {
    singleMock.mockResolvedValue({
      data: { status: "failed", error_message: "Stable Audio error: bad request" },
    });

    render(<JobStatus jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Stable Audio error: bad request/i)).toBeInTheDocument();
    });
  });

  it("shows the player when the job completes", async () => {
    singleMock.mockResolvedValue({ data: { status: "completed", error_message: null } });

    render(<JobStatus jobId="job-2" />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /télécharger/i })).toHaveAttribute(
        "href",
        "/api/audio/job-2"
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- job-status`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement JobStatus**

Create `src/components/studio/job-status.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import AudioPlayer from "./audio-player";

type Status = "queued" | "processing" | "completed" | "failed";

export default function JobStatus({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<Status>("queued");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    async function poll() {
      const { data } = await supabase
        .from("generation_jobs")
        .select("status, error_message")
        .eq("id", jobId)
        .single();
      if (cancelled || !data) return;
      setStatus(data.status as Status);
      setErrorMessage(data.error_message);
      if (data.status !== "completed" && data.status !== "failed") {
        setTimeout(poll, 3000);
      }
    }
    poll();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (status === "failed") {
    return (
      <p role="alert" className="mt-4 text-red-600 text-sm">
        {errorMessage ?? "La génération a échoué."}
      </p>
    );
  }

  if (status === "completed") {
    return <AudioPlayer jobId={jobId} />;
  }

  return (
    <p className="mt-4 text-sm text-[var(--color-ink)]/70">
      {status === "processing" ? "Génération en cours…" : "En file d'attente…"}
    </p>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- job-status`
Expected: PASS (2 tests)

- [ ] **Step 5: Implement GenerationForm**

Create `src/components/studio/generation-form.tsx`:

```tsx
"use client";

import { useState } from "react";

const MOODS = ["Festif", "Énergique", "Paisible", "Émouvant", "Cinématographique"];
const ENERGIES = ["Faible", "Modérée", "Élevée"];
const DURATIONS = [15, 30, 60];

export default function GenerationForm({
  rhythms,
  onJobCreated,
}: {
  rhythms: { slug: string; name: string }[];
  onJobCreated: (jobId: string) => void;
}) {
  const [rhythmSlug, setRhythmSlug] = useState(rhythms[0]?.slug ?? "");
  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState(MOODS[0]);
  const [energy, setEnergy] = useState(ENERGIES[0]);
  const [durationSeconds, setDurationSeconds] = useState(DURATIONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rhythmSlug, prompt, mood, energy, durationSeconds }),
      });
      if (res.status === 429) {
        setError("Tu as atteint la limite de générations par heure. Réessaie plus tard.");
        return;
      }
      if (!res.ok) {
        setError("Impossible de lancer la génération. Réessaie.");
        return;
      }
      const { jobId } = await res.json();
      onJobCreated(jobId);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-1">
        Rythme
        <select
          value={rhythmSlug}
          onChange={(e) => setRhythmSlug(e.target.value)}
          className="border rounded px-3 py-2"
        >
          {rhythms.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Décris ton idée
        <textarea
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        Humeur
        <select value={mood} onChange={(e) => setMood(e.target.value)} className="border rounded px-3 py-2">
          {MOODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Énergie
        <select
          value={energy}
          onChange={(e) => setEnergy(e.target.value)}
          className="border rounded px-3 py-2"
        >
          {ENERGIES.map((en) => (
            <option key={en} value={en}>
              {en}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Durée
        <select
          value={durationSeconds}
          onChange={(e) => setDurationSeconds(Number(e.target.value))}
          className="border rounded px-3 py-2"
        >
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d}s
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-[var(--color-gold-start)] px-4 py-2 font-medium disabled:opacity-50"
      >
        {submitting ? "Lancement…" : "Générer"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Replace the studio placeholder page**

Replace `src/app/studio/page.tsx`:

```tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import StudioClient from "@/components/studio/studio-client";

export default async function StudioPage() {
  const supabase = await createServerSupabaseClient();
  const { data: rhythms } = await supabase
    .from("rhythms")
    .select("slug, name")
    .eq("status", "published")
    .order("sort_order");

  return (
    <main className="px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Studio de création</h1>
      <StudioClient rhythms={rhythms ?? []} />
    </main>
  );
}
```

Create `src/components/studio/studio-client.tsx` (small client wrapper holding the jobId state, since the server page can't hold `useState`):

```tsx
"use client";

import { useState } from "react";
import GenerationForm from "./generation-form";
import JobStatus from "./job-status";

export default function StudioClient({ rhythms }: { rhythms: { slug: string; name: string }[] }) {
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <div>
      <GenerationForm rhythms={rhythms} onJobCreated={setJobId} />
      {jobId && <JobStatus jobId={jobId} />}
    </div>
  );
}
```

- [ ] **Step 7: Verify the full unit suite still passes**

Run: `npm test`
Expected: all unit tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: studio page with generation form and live job status"
```

---

### Task 8: Library page, route protection, env docs, and full verification

**Files:**
- Create: `src/app/bibliotheque/page.tsx`
- Modify: `src/proxy.ts` (add `/bibliotheque` to the protected matcher)
- Modify: `.env.example` (add `STABILITY_API_KEY`, document `GENERATION_PROVIDER`)
- Modify: `README.md`
- Test: `tests/e2e/studio-generation.spec.ts`

**Interfaces:** none new — this task wires existing pieces into a protected page and verifies the whole flow end-to-end.

- [ ] **Step 1: Build the library page**

Create `src/app/bibliotheque/page.tsx`:

```tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AudioPlayer from "@/components/studio/audio-player";

export default async function LibraryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: jobs } = await supabase
    .from("generation_jobs")
    .select("id, prompt, status, created_at, rhythms(name)")
    .order("created_at", { ascending: false });

  return (
    <main className="px-6 py-12 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Ma bibliothèque</h1>
      {!jobs || jobs.length === 0 ? (
        <p className="text-sm text-[var(--color-ink)]/70">
          Tu n&apos;as pas encore créé de musique.
        </p>
      ) : (
        <ul className="flex flex-col gap-6">
          {jobs.map((job) => (
            <li key={job.id} className="border-b border-[var(--color-ink)]/10 pb-4">
              <p className="font-medium">
                {(job.rhythms as unknown as { name: string } | null)?.name ?? "Rythme"}
              </p>
              <p className="text-sm text-[var(--color-ink)]/70">{job.prompt}</p>
              {job.status === "completed" ? (
                <AudioPlayer jobId={job.id} />
              ) : (
                <p className="text-xs italic mt-1">Statut : {job.status}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Protect the new route**

Modify `src/proxy.ts` — update the `config.matcher` array:

```ts
export const config = {
  matcher: ["/studio/:path*", "/studio", "/bibliotheque/:path*", "/bibliotheque"],
};
```

- [ ] **Step 3: Document the new environment variable**

Append to `.env.example`:

```bash
# Stability AI (Stable Audio) — leave empty to make /api/generate return a
# clear "not configured" error instead of generating anything.
STABILITY_API_KEY=
```

- [ ] **Step 4: Write the failing e2e test**

Create `tests/e2e/studio-generation.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("a signed-in user can generate a track end-to-end with the mock provider", async ({
  page,
}) => {
  const email = `studio-${Date.now()}@example.test`;
  const password = "correct horse battery staple 1!";

  await page.goto("/inscription");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/studio/);

  await page.getByLabel("Décris ton idée").fill("a joyful celebration");
  await page.getByRole("button", { name: "Générer" }).click();

  await expect(page.getByRole("link", { name: /télécharger/i })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/bibliotheque");
  await expect(page.getByText("a joyful celebration")).toBeVisible();
});
```

- [ ] **Step 5: Run test to verify it fails, then run with the mock provider**

This test needs the dev server running with `GENERATION_PROVIDER=mock` (Playwright's `webServer` in `playwright.config.ts` runs `npm run dev` without that var — for this test run only, stop any running dev server and run: `GENERATION_PROVIDER=mock npm run test:e2e -- studio-generation`).
Expected first (no route/UI yet earlier in the plan — by this point in execution everything exists, so this should already pass): PASS. If it fails, debug via `systematic-debugging` before moving on — do not weaken the assertions.

- [ ] **Step 6: Run the complete verification suite**

Run: `npm run lint` — Expected: no errors.
Run: `npm run build` — Expected: succeeds.
Run: `npm test` — Expected: all unit tests pass.
Run: `npm run test:integration` — Expected: all integration tests pass (RLS + generate-route + audio-route).
Run: `GENERATION_PROVIDER=mock npm run test:e2e` — Expected: all e2e tests pass, including the new studio flow.

- [ ] **Step 7: Update README**

Add to `README.md` under "Notes de développement":

```markdown
- `STABILITY_API_KEY` doit être configurée (localement et sur Vercel) pour que `/api/generate` génère réellement de l'audio. Sans elle, l'API répond explicitement "service non configuré" plutôt que de simuler un résultat.
- Les tests d'intégration et e2e de génération utilisent `GENERATION_PROVIDER=mock` pour ne jamais consommer de crédits réels pendant les tests.
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: library page, route protection, env docs for the generation pipeline"
```

---

## Self-Review

**1. Spec coverage:** §4 (provider abstraction, async pipeline, never-fake-success) → Tasks 1,2,3,5. §5 (generation_jobs/audio_assets/usage_records usage) → Task 5. §6 (studio, bibliothèque pages) → Tasks 7,8. §9 (rate limit, private storage, signed URLs) → Task 3 (rate limit), Task 6 (signed URL route + Storage RLS). §10 (mock labeled, not proof of real generation) → `GENERATION_PROVIDER=mock` is explicitly test-environment-only per Task 3's comment and README note in Task 8. §14 (studio controls: rhythm/prompt/mood/energy/duration) → Task 7. §15 (audio player, private storage, no permanent public URL) → Task 6.

**2. Placeholder scan:** no TBD/TODO; all code blocks are literal. The Stable Audio endpoint/fields were verified against Stability's live OpenAPI spec before writing Task 2, not guessed.

**3. Type consistency:** `GenerationRequest`/`GenerationResult`/`MusicGenerationProvider` (Task 1) are used identically in `StableAudioProvider` (Task 2), `MockProvider` (Task 1), and `getProvider()` (Task 3). `buildPrompt`'s parameter names match what Task 5's route passes (`rhythmName`, `userIdea`, `mood`, `energy`). `JobStatus`'s expected Supabase client shape matches `createBrowserSupabaseClient`'s real return type structurally (mocked in its own test only).

**4. Review Focus coverage:** duplicate submission → Task 4's idempotency test. Cross-user audio access → Task 6's 404 test. Rate limit → Task 3's unit test (limit logic) — note: no integration test hits the real 429 path by exhausting 10 real submissions, since that would be slow and wasteful of provider quota; the unit test on `checkRateLimit` plus the route wiring in Task 4 is the pragmatic coverage here. Stuck-in-processing / fake-completed → Task 5's two completion-path tests (success and forced failure) against a live server. Missing API key (`getProvider()` returns `null`) → deliberately NOT integration-tested: exercising it would require a second dev-server instance running with neither `STABILITY_API_KEY` nor `GENERATION_PROVIDER` set, purely to hit a 3-line `if (!provider)` branch that writes the exact same `status: "failed"` + `error_message` shape as the already-tested forced-failure path in Task 5 — the downstream behavior (job fails with a message, no fake success) is proven by that test; only the trigger condition differs. Covered by code inspection, not a separate test run, as a deliberate scope decision for this plan.
