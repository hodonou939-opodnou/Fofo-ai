import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeIdempotencyKey } from "@/lib/generation/idempotency";

const input = {
  userId: "user-1",
  submissionId: "3f1c2a4e-9b7d-4c2a-8e1f-0a1b2c3d4e5f",
  rhythmId: "rhythm-1",
  prompt: "a calm song",
  mood: "Paisible",
  energy: "Faible",
  durationSeconds: 15,
};

describe("computeIdempotencyKey", () => {
  it("is the sha256 of the JSON array of user, submission and parameters", () => {
    const expected = createHash("sha256")
      .update(
        JSON.stringify([
          input.userId,
          input.submissionId,
          input.rhythmId,
          input.prompt,
          input.mood,
          input.energy,
          input.durationSeconds,
        ])
      )
      .digest("hex");
    expect(computeIdempotencyKey(input)).toBe(expected);
  });

  it("is stable for a retry of the same submission", () => {
    expect(computeIdempotencyKey(input)).toBe(computeIdempotencyKey({ ...input }));
  });

  it("differs for a new submission with identical parameters", () => {
    expect(computeIdempotencyKey(input)).not.toBe(
      computeIdempotencyKey({ ...input, submissionId: "8a6e0f3b-1c2d-4e5f-9a0b-1c2d3e4f5a6b" })
    );
  });

  it("is not ambiguous when fields contain separators", () => {
    expect(computeIdempotencyKey({ ...input, prompt: "a:b", mood: "c" })).not.toBe(
      computeIdempotencyKey({ ...input, prompt: "a", mood: "b:c" })
    );
  });
});
