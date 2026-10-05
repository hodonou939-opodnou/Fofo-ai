import { createHash } from "node:crypto";

// One key per (user, submission, parameters): a network retry of the same
// submission maps to the same job, a deliberate new submission does not.
// JSON.stringify keeps the fields unambiguous even when they contain ":".
export function computeIdempotencyKey(input: {
  userId: string;
  submissionId: string;
  rhythmId: string;
  prompt: string;
  mood: string;
  energy: string;
  durationSeconds: number;
}): string {
  return createHash("sha256")
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
}
