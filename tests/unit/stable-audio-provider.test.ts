import { afterEach, describe, expect, it, vi } from "vitest";
import { StableAudioProvider } from "@/lib/generation/stable-audio-provider";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe("StableAudioProvider", () => {
  it("sends the correct endpoint, auth header, and form fields, and returns the audio bytes on success", async () => {
    const fakeAudio = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "audio/mpeg" }),
      arrayBuffer: async () => fakeAudio.buffer,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new StableAudioProvider("sk-test-key");
    const result = await provider.generate({ prompt: "a calm song", durationSeconds: 30 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.format).toBe("mp3");
      expect(Buffer.from(result.audio)).toEqual(Buffer.from(fakeAudio));
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer sk-test-key");
    expect(init.headers.accept).toBe("audio/*");
    const body = init.body as FormData;
    expect(body.get("prompt")).toBe("a calm song");
    expect(body.get("duration")).toBe("30");
    expect(body.get("model")).toBe("stable-audio-2.5");
    expect(body.get("output_format")).toBe("mp3");
  });

  it("returns a readable error message on a non-200 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: "abc", name: "bad_request", errors: ["prompt is required"] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new StableAudioProvider("sk-test-key");
    const result = await provider.generate({ prompt: "", durationSeconds: 30 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toContain("prompt is required");
    }
  });
});
