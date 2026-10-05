import type { GenerationRequest, GenerationResult, MusicGenerationProvider } from "./provider";

// Minimal valid WAV header (44 bytes) + a little silence, so it's a real
// playable file, not an arbitrary byte blob. Test-only — never used in
// production (see get-provider.ts).
function silentWav(): Buffer {
  const sampleRate = 44100;
  const numSamples = sampleRate; // 1 second of silence
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + numSamples * 2, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(numSamples * 2, 40);
  return Buffer.concat([header, Buffer.alloc(numSamples * 2)]);
}

export class MockProvider implements MusicGenerationProvider {
  name = "mock";

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (request.prompt.includes("FORCE_FAIL")) {
      return { ok: false, kind: "unavailable", detail: "Mock provider forced failure (FORCE_FAIL)." };
    }
    return { ok: true, audio: silentWav(), format: "wav", sampleRate: 44100 };
  }
}
