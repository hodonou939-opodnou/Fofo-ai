import { afterEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsProvider } from "@/lib/generation/elevenlabs-provider";
import { PROVIDER_ATTEMPT_TIMEOUT_MS } from "@/lib/generation/stable-audio-provider";

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

function errorResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  };
}

function audioResponse(contentType: string, bytes: Uint8Array) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": contentType }),
    arrayBuffer: async () => bytes.buffer,
  };
}

async function generate(durationSeconds = 30) {
  return new ElevenLabsProvider("sk_test_key").generate({ prompt: "a calm song", durationSeconds });
}

describe("ElevenLabsProvider", () => {
  it("calls the Music API with the key, an instrumental-only request of the chosen length, and returns MP3 bytes", async () => {
    const fakeAudio = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
    const fetchMock = mockFetch(async () => audioResponse("audio/mpeg", fakeAudio));

    const result = await generate(60);

    expect(result).toMatchObject({ ok: true, format: "mp3", sampleRate: 44_100 });
    if (result.ok) expect(Buffer.from(result.audio)).toEqual(Buffer.from(fakeAudio));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128");
    expect(init.method).toBe("POST");
    expect(init.headers["xi-api-key"]).toBe("sk_test_key");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      prompt: "a calm song",
      music_length_ms: 60_000,
      model_id: "music_v1",
      force_instrumental: true,
    });
  });

  it("bounds each attempt with the shared provider timeout", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = mockFetch(async () => audioResponse("audio/mpeg", new Uint8Array([1])));
    await generate();
    expect(timeoutSpy).toHaveBeenCalledWith(PROVIDER_ATTEMPT_TIMEOUT_MS);
    expect(fetchMock.mock.calls[0][1].signal).toBe(timeoutSpy.mock.results[0].value);
  });

  // ElevenLabs answers copyrighted or harmful prompts with detail.status "bad_prompt"
  // (or "bad_composition_plan"), often with a suggested prompt.
  it.each(["bad_prompt", "bad_composition_plan"])("classifies a %s refusal as refused, whatever the HTTP code", async (status) => {
    mockFetch(async () =>
      errorResponse(400, { detail: { status, message: "contains copyrighted material", data: { prompt_suggestion: "x" } } })
    );
    const result = await generate();
    expect(result).toMatchObject({ ok: false, kind: "refused" });
    if (!result.ok) expect(result.detail).toContain(status);
  });

  // 401 bad key / missing permission, 402 no paid plan or no credits, 429 rate
  // limit, 5xx outage: none of them is the user's fault.
  it.each([401, 402, 429, 500, 503])("classifies HTTP %i as unavailable", async (status) => {
    mockFetch(async () => errorResponse(status, { detail: { status: "limited_access", message: "nope" } }));
    expect(await generate()).toMatchObject({ ok: false, kind: "unavailable" });
  });

  // Observed in production 2026-10-11: a bad key comes back as HTTP 400 (not 401)
  // with detail.type "authentication_error" — never the user's fault.
  it("classifies an authentication error as unavailable even when ElevenLabs sends it as HTTP 400", async () => {
    mockFetch(async () =>
      errorResponse(400, {
        detail: {
          type: "authentication_error",
          code: "invalid_api_key",
          status: "api_key_id_used_as_api_key",
          message: "API key ID used as API key - only valid API keys can be used.",
        },
      })
    );
    const result = await generate();
    expect(result).toMatchObject({ ok: false, kind: "unavailable" });
    if (!result.ok) expect(result.detail).toContain("api_key_id_used_as_api_key");
  });

  it("classifies another 4xx (e.g. a validation error) as invalid and keeps the API's text", async () => {
    mockFetch(async () => errorResponse(422, { detail: [{ loc: ["body", "music_length_ms"], msg: "too short", type: "value_error" }] }));
    const result = await generate();
    expect(result).toMatchObject({ ok: false, kind: "invalid" });
    if (!result.ok) expect(result.detail).toContain("too short");
  });

  it("keeps the HTTP status as the detail when the error body is not JSON", async () => {
    mockFetch(async () => ({ ok: false, status: 502, headers: new Headers(), json: async () => { throw new SyntaxError("not json"); } }));
    const result = await generate();
    expect(result).toMatchObject({ ok: false, kind: "unavailable" });
    if (!result.ok) expect(result.detail).toContain("502");
  });

  it("classifies a network error as unavailable", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await generate()).toMatchObject({ ok: false, kind: "unavailable" });
  });

  it("classifies an aborted attempt as timeout", async () => {
    mockFetch(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    expect(await generate()).toMatchObject({ ok: false, kind: "timeout" });
  });

  it("classifies a timeout while reading the audio body as timeout", async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "audio/mpeg" }),
      arrayBuffer: async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      },
    }));
    expect(await generate()).toMatchObject({ ok: false, kind: "timeout" });
  });

  it("accepts a binary body served as application/octet-stream", async () => {
    mockFetch(async () => audioResponse("application/octet-stream", new Uint8Array([0xff, 0xfb])));
    expect(await generate()).toMatchObject({ ok: true });
  });

  it("rejects a 200 response that is not audio", async () => {
    mockFetch(async () => audioResponse("application/json", new Uint8Array([123, 125])));
    expect(await generate()).toMatchObject({ ok: false, kind: "unavailable" });
  });

  it("rejects an empty audio body", async () => {
    mockFetch(async () => audioResponse("audio/mpeg", new Uint8Array([])));
    expect(await generate()).toMatchObject({ ok: false, kind: "unavailable" });
  });

  it("is named so stored jobs record which provider made them", () => {
    expect(new ElevenLabsProvider("k").name).toBe("elevenlabs");
  });
});
