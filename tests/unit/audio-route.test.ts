// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createRouteSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/route", () => ({
  createRouteSupabaseClient: mocks.createRouteSupabaseClient,
}));

import { GET } from "@/app/api/audio/[jobId]/route";

function fakeSupabase({
  user = { id: "user-1" } as { id: string } | null,
  asset = {
    storage_path: "user-1/job-1.wav",
    format: "wav",
    generation_jobs: { user_id: "user-1" },
  } as Record<string, unknown> | null,
} = {}) {
  const createSignedUrl = vi.fn(async () => ({
    data: { signedUrl: "https://storage.example/signed?token=abc" },
    error: null,
  }));
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: asset, error: null }) }) }),
    }),
    storage: { from: () => ({ createSignedUrl }) },
  };
  mocks.createRouteSupabaseClient.mockResolvedValue(client);
  return { createSignedUrl };
}

function get(url: string) {
  return GET(new Request(url), { params: Promise.resolve({ jobId: "job-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/audio/:jobId", () => {
  it("redirects the owner to a short-lived signed URL for playback", async () => {
    const { createSignedUrl } = fakeSupabase();

    const res = await get("http://localhost/api/audio/job-1");

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://storage.example/signed?token=abc");
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/job-1.wav", 3600, undefined);
  });

  it("asks storage for an attachment download with a readable file name when ?download=1", async () => {
    const { createSignedUrl } = fakeSupabase();

    const res = await get("http://localhost/api/audio/job-1?download=1");

    expect(res.status).toBe(307);
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/job-1.wav", 3600, {
      download: "fofo-job-1.wav",
    });
  });

  it("returns 404 when the asset is not visible to the requester", async () => {
    const { createSignedUrl } = fakeSupabase({ asset: null });

    const res = await get("http://localhost/api/audio/job-1");

    expect(res.status).toBe(404);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns 401 for an unauthenticated request", async () => {
    fakeSupabase({ user: null });

    const res = await get("http://localhost/api/audio/job-1");

    expect(res.status).toBe(401);
  });
});
