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
