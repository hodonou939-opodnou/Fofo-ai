import type { GenerationRequest, GenerationResult, MusicGenerationProvider } from "./provider";

const ENDPOINT = "https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio";

export class StableAudioProvider implements MusicGenerationProvider {
  name = "stable-audio";

  constructor(private readonly apiKey: string) {}

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const form = new FormData();
    form.set("prompt", request.prompt);
    form.set("duration", String(request.durationSeconds));
    form.set("model", "stable-audio-2.5");
    form.set("output_format", "mp3");

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          accept: "audio/*",
        },
        body: form,
      });
    } catch (err) {
      return {
        ok: false,
        errorMessage: `Network error contacting Stable Audio: ${(err as Error).message}`,
      };
    }

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (Array.isArray(body.errors)) detail = body.errors.join(", ");
      } catch {
        // body wasn't JSON, keep the HTTP status as the detail
      }
      return { ok: false, errorMessage: `Stable Audio error: ${detail}` };
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return { ok: true, audio: bytes, format: "mp3", sampleRate: 44100 };
  }
}
