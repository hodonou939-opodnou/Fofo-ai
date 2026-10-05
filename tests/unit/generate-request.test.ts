import { describe, expect, it } from "vitest";
import { parseGenerateRequest } from "@/lib/generation/generate-request";
import { PROMPT_MAX_LENGTH } from "@/lib/generation/options";

const valid = {
  rhythmSlug: "zinli",
  prompt: "a calm evening song",
  mood: "Paisible",
  energy: "Modérée",
  durationSeconds: 15,
  submissionId: "3f1c2a4e-9b7d-4c2a-8e1f-0a1b2c3d4e5f",
};

describe("parseGenerateRequest", () => {
  it("accepts a well-formed request", () => {
    expect(parseGenerateRequest(valid)).toEqual(valid);
  });

  it("trims the prompt", () => {
    expect(parseGenerateRequest({ ...valid, prompt: "  une fête  " })?.prompt).toBe("une fête");
  });

  it.each([
    ["a missing body", null],
    ["a non-object body", "hello"],
    ["a missing submissionId", { ...valid, submissionId: undefined }],
    ["a non-UUID submissionId", { ...valid, submissionId: "not-a-uuid" }],
    ["an empty rhythm slug", { ...valid, rhythmSlug: "" }],
    ["a blank prompt", { ...valid, prompt: "   " }],
    ["a prompt over the maximum length", { ...valid, prompt: "a".repeat(PROMPT_MAX_LENGTH + 1) }],
    ["an unknown mood", { ...valid, mood: "Triste" }],
    ["an empty mood", { ...valid, mood: "" }],
    ["an unknown energy", { ...valid, energy: "Extrême" }],
    ["an unsupported duration", { ...valid, durationSeconds: 45 }],
    ["a duration sent as a string", { ...valid, durationSeconds: "15" }],
  ])("rejects %s", (_label, body) => {
    expect(parseGenerateRequest(body)).toBeNull();
  });

  it("accepts a prompt of exactly the maximum length", () => {
    const prompt = "a".repeat(PROMPT_MAX_LENGTH);
    expect(parseGenerateRequest({ ...valid, prompt })?.prompt).toBe(prompt);
  });
});
