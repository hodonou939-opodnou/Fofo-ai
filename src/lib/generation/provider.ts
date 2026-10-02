export type GenerationRequest = {
  prompt: string;
  durationSeconds: number;
};

export type GenerationResult =
  | { ok: true; audio: Buffer; format: "mp3" | "wav"; sampleRate: number }
  | { ok: false; errorMessage: string };

export interface MusicGenerationProvider {
  name: string;
  generate(request: GenerationRequest): Promise<GenerationResult>;
}
