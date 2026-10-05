// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProvider } from "@/lib/generation/mock-provider";
import { buildPrompt } from "@/lib/generation/build-prompt";
import { computeIdempotencyKey } from "@/lib/generation/idempotency";
import { MAX_GENERATIONS_PER_HOUR } from "@/lib/generation/rate-limit";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  getProvider: vi.fn(),
  createRouteSupabaseClient: vi.fn(),
  processGenerationJob: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));
vi.mock("@/lib/generation/get-provider", () => ({ getProvider: mocks.getProvider }));
vi.mock("@/lib/supabase/route", () => ({
  createRouteSupabaseClient: mocks.createRouteSupabaseClient,
}));
vi.mock("@/lib/generation/process-job", () => ({
  processGenerationJob: mocks.processGenerationJob,
}));

import { POST } from "@/app/api/generate/route";

const validBody = {
  rhythmSlug: "zinli",
  prompt: "une fête de mariage",
  mood: "Festif",
  energy: "Élevée",
  durationSeconds: 15,
  submissionId: "3f1c2a4e-9b7d-4c2a-8e1f-0a1b2c3d4e5f",
};

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function fakeSupabase({
  user = { id: "user-1" } as { id: string } | null,
  rhythm = { id: "rhythm-1", name: "Zinli" } as { id: string; name: string } | null,
  rpcResult = { data: { job_id: "job-1", created: true }, error: null } as RpcResult,
} = {}) {
  const single = vi.fn(async () => rpcResult);
  const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => { single: typeof single }>(
    () => ({ single })
  );
  const maybeSingle = vi.fn(async () => ({ data: rhythm, error: null }));
  const from = vi.fn(() => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
  }));
  const client = { auth: { getUser: async () => ({ data: { user } }) }, from, rpc };
  mocks.createRouteSupabaseClient.mockResolvedValue(client);
  return { client, rpc, from };
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const provider = new MockProvider();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProvider.mockReturnValue(provider);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/generate", () => {
  it("returns 401 for an unauthenticated request, labelled with the active provider", async () => {
    fakeSupabase({ user: null });

    const res = await post(validBody);

    expect(res.status).toBe(401);
    expect(res.headers.get("x-generation-provider")).toBe("mock");
  });

  it("labels responses 'none' when no provider is configured", async () => {
    mocks.getProvider.mockReturnValue(null);
    fakeSupabase({ user: null });

    const res = await post(validBody);

    expect(res.headers.get("x-generation-provider")).toBe("none");
  });

  it("does not expose the provider header in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    fakeSupabase({ user: null });

    const res = await post(validBody);

    expect(res.status).toBe(401);
    expect(res.headers.has("x-generation-provider")).toBe(false);
  });

  it.each([
    ["a missing submissionId", { ...validBody, submissionId: undefined }],
    ["a malformed submissionId", { ...validBody, submissionId: "123" }],
    ["a mood outside the allowed values", { ...validBody, mood: "" }],
  ])("returns 400 invalid_request for %s", async (_label, body) => {
    const db = fakeSupabase();

    const res = await post(body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
    expect(res.headers.get("x-generation-provider")).toBe("mock");
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("returns 503 service_unavailable without creating a job when no provider is configured", async () => {
    mocks.getProvider.mockReturnValue(null);
    const db = fakeSupabase();

    const res = await post(validBody);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "service_unavailable" });
    expect(res.headers.get("x-generation-provider")).toBe("none");
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown rhythm", async () => {
    const db = fakeSupabase({ rhythm: null });

    const res = await post(validBody);

    expect(res.status).toBe(404);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("creates the job through the atomic RPC and schedules the worker for a new job", async () => {
    const db = fakeSupabase();

    const res = await post(validBody);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ jobId: "job-1" });
    expect(db.rpc).toHaveBeenCalledWith("create_generation_job", {
      p_rhythm_id: "rhythm-1",
      p_prompt: validBody.prompt,
      p_mood: "Festif",
      p_energy: "Élevée",
      p_duration_seconds: 15,
      p_provider: "mock",
      p_idempotency_key: computeIdempotencyKey({
        userId: "user-1",
        submissionId: validBody.submissionId,
        rhythmId: "rhythm-1",
        prompt: validBody.prompt,
        mood: "Festif",
        energy: "Élevée",
        durationSeconds: 15,
      }),
      p_max_per_hour: MAX_GENERATIONS_PER_HOUR,
    });

    expect(mocks.after).toHaveBeenCalledTimes(1);
    await mocks.after.mock.calls[0][0]();
    expect(mocks.processGenerationJob).toHaveBeenCalledWith({
      supabase: db.client,
      provider,
      job: {
        id: "job-1",
        userId: "user-1",
        prompt: buildPrompt({
          rhythmName: "Zinli",
          userIdea: validBody.prompt,
          mood: "Festif",
          energy: "Élevée",
        }),
        durationSeconds: 15,
      },
    });
  });

  it("returns the existing job without scheduling the worker again for a retried submission", async () => {
    fakeSupabase({ rpcResult: { data: { job_id: "job-1", created: false }, error: null } });

    const res = await post(validBody);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ jobId: "job-1" });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("returns 429 rate_limited when the RPC reports the hourly limit", async () => {
    fakeSupabase({
      rpcResult: { data: null, error: { code: "PT429", message: "generation rate limit exceeded" } },
    });

    const res = await post(validBody);

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("returns 500 when job creation fails for another reason", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeSupabase({ rpcResult: { data: null, error: { code: "23505", message: "duplicate key" } } });

    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
