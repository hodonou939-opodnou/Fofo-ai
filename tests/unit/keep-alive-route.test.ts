// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createRouteSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/route", () => ({
  createRouteSupabaseClient: mocks.createRouteSupabaseClient,
}));

import { GET } from "@/app/api/keep-alive/route";

function fakeSupabase(result: { data: unknown; error: { message: string } | null }) {
  const calls: unknown[][] = [];
  const query = {
    select: (...args: unknown[]) => (calls.push(["select", ...args]), query),
    eq: (...args: unknown[]) => (calls.push(["eq", ...args]), query),
    limit: async (...args: unknown[]) => (calls.push(["limit", ...args]), result),
  };
  const from = vi.fn(() => query);
  mocks.createRouteSupabaseClient.mockResolvedValue({ from });
  return { from, calls };
}

const request = () => new Request("https://fofo-ai.vercel.app/api/keep-alive");

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.createRouteSupabaseClient.mockReset();
});

describe("GET /api/keep-alive", () => {
  it("reads one published rhythm so the database counts as active, and says so", async () => {
    const db = fakeSupabase({ data: [{ id: "r1" }], error: null });

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.from).toHaveBeenCalledWith("rhythms");
    expect(db.calls).toEqual([
      ["select", "id"],
      ["eq", "status", "published"],
      ["limit", 1],
    ]);
  });

  it("answers 503 without details when the database cannot be read (e.g. a paused project)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fakeSupabase({ data: null, error: { message: "TypeError: fetch failed" } });

    const res = await GET(request());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(consoleError).toHaveBeenCalled();
  });

  it("answers 503 when creating the client throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createRouteSupabaseClient.mockRejectedValue(new Error("boom"));

    const res = await GET(request());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
  });
});

describe("vercel.json", () => {
  it("calls the keep-alive once a day (the Hobby plan refuses anything more frequent)", () => {
    const config = JSON.parse(readFileSync(path.resolve(__dirname, "../../vercel.json"), "utf8"));
    const job = config.crons.find((c: { path: string }) => c.path === "/api/keep-alive");
    expect(job).toBeDefined();
    // minute and hour fixed, every day: e.g. "0 6 * * *"
    expect(job.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });
});
