export type GenerationRequest = {
  prompt: string;
  durationSeconds: number;
};

// Why a generation failed, independent of the provider. The route turns each
// kind into a French message for the user; `detail` is diagnostic text for
// the server logs only (it may name the provider or contain raw API errors).
//   timeout     — the attempt did not finish in time
//   unavailable — the provider could not serve us (network, 5xx, auth, quota)
//   refused     — the provider refused the content (moderation)
//   invalid     — the provider rejected the request parameters
export type GenerationFailureKind = "timeout" | "unavailable" | "refused" | "invalid";

export type GenerationResult =
  | { ok: true; audio: Buffer; format: "mp3" | "wav"; sampleRate: number }
  | { ok: false; kind: GenerationFailureKind; detail: string };

export interface MusicGenerationProvider {
  name: string;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}
