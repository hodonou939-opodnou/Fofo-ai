import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROVIDER_ATTEMPT_TIMEOUT_MS,
  StableAudioProvider,
} from "@/lib/generation/stable-audio-provider";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetch(implementation: () => Promise<unknown>) {
  const fetchMock = vi.fn().mockImplementation(implementation);
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function errorResponse(status: number, json: () => Promise<unknown>) {
  return { ok: false, status, headers: new Headers({ "content-type": "application/json" }), json };
}

function audioResponse(contentType: string, bytes: Uint8Array) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": contentType }),
    arrayBuffer: async () => bytes.buffer,
  };
}

async function generate() {
  return new StableAudioProvider("sk-test-key").generate({ prompt: "a calm song", durationSeconds: 30 });
}

describe("StableAudioProvider", () => {
  it("sends the correct endpoint, auth header, and form fields, and returns the audio bytes on success", async () => {
    const fakeAudio = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = mockFetch(async () => audioResponse("audio/mpeg", fakeAudio));

    const result = await generate();

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

  it("bounds each attempt with a 45 s abort signal", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = mockFetch(async () => audioResponse("audio/mpeg", new Uint8Array([1])));

    await generate();

    expect(PROVIDER_ATTEMPT_TIMEOUT_MS).toBe(45_000);
    expect(timeoutSpy).toHaveBeenCalledWith(PROVIDER_ATTEMPT_TIMEOUT_MS);
    expect(fetchMock.mock.calls[0][1].signal).toBe(timeoutSpy.mock.results[0].value);
  });

  it("classifies a 400 as invalid and keeps the provider's error text as the detail", async () => {
    mockFetch(async () =>
      errorResponse(400, async () => ({ name: "bad_request", errors: ["prompt is required"] }))
    );

    const result = await generate();

    expect(result).toMatchObject({ ok: false, kind: "invalid" });
    if (!result.ok) expect(result.detail).toContain("prompt is required");
  });

  it("classifies a 403 as refused (content moderation)", async () => {
    mockFetch(async () => errorResponse(403, async () => ({ errors: ["flagged by moderation"] })));
    expect(await generate()).toMatchObject({ ok: false, kind: "refused" });
  });

  it.each([401, 429, 500, 503])("classifies HTTP %i as unavailable", async (status) => {
    mockFetch(async () => errorResponse(status, async () => ({ errors: ["nope"] })));
    expect(await generate()).toMatchObject({ ok: false, kind: "unavailable" });
  });

  it("keeps the HTTP status as the detail when the error body is not JSON", async () => {
    mockFetch(async () =>
      errorResponse(502, async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      })
    );

    const result = await generate();

    expect(result).toMatchObject({ ok: false, kind: "unavailable" });
    if (!result.ok) expect(result.detail).toContain("HTTP 502");
  });

  it("classifies a network error as unavailable", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await generate();

    expect(result).toMatchObject({ ok: false, kind: "unavailable" });
    if (!result.ok) expect(result.detail).toContain("fetch failed");
  });

  it("classifies an aborted attempt as timeout", async () => {
    mockFetch(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    expect(await generate()).toMatchObject({ ok: false, kind: "timeout" });
  });

  it("classifies a failure while reading the audio body as unavailable", async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "audio/mpeg" }),
      arrayBuffer: async () => {
        throw new TypeError("terminated");
      },
    }));
    expect(await generate()).toMatchObject({ ok: false, kind: "unavailable" });
  });

  it("classifies a timeout while reading the audio body as timeout", async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "audio/mpeg" }),
      arrayBuffer: async () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      },
    }));
    expect(await generate()).toMatchObject({ ok: false, kind: "timeout" });
  });

  it("rejects a 200 response that is not audio", async () => {
    mockFetch(async () => audioResponse("application/json", new Uint8Array([123, 125])));
    expect(await generate()).toMatchObject({ ok: false, kind: "unavailable" });
  });

  it("rejects an empty audio body", async () => {
    mockFetch(async () => audioResponse("audio/mpeg", new Uint8Array([])));
    expect(await generate()).toMatchObject({ ok: false, kind: "unavailable" });
  });
});
