import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/generation/mock-provider";

describe("MockProvider", () => {
  it("is labelled as the mock", () => {
    expect(new MockProvider().name).toBe("mock");
  });

  it("returns a playable fake audio buffer for a normal prompt", async () => {
    const provider = new MockProvider();
    const result = await provider.generate({ prompt: "a happy song", durationSeconds: 15 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.audio.length).toBeGreaterThan(0);
      expect(result.format).toBe("wav");
    }
  });

  it("simulates a categorized provider failure when the prompt contains the sentinel FORCE_FAIL", async () => {
    const provider = new MockProvider();
    const result = await provider.generate({ prompt: "FORCE_FAIL this one", durationSeconds: 15 });
    expect(result).toMatchObject({ ok: false, kind: "unavailable" });
    if (!result.ok) {
      expect(result.detail).toBeTruthy();
    }
  });
});
