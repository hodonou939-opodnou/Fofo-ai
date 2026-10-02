import { describe, expect, it } from "vitest";
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
