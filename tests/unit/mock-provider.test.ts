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
