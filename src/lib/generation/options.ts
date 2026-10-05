// Single source of truth for the Studio's generation options, shared by the
// form (which shows the French labels) and the API route (which only accepts
// these values). The English descriptors are what buildPrompt sends to the
// provider: the provider prompt is never composed in Fon (spec §4, §8).

export const MOOD_DESCRIPTORS = {
  Festif: "festive",
  "Énergique": "energetic",
  Paisible: "peaceful",
  "Émouvant": "emotional",
  "Cinématographique": "cinematic",
} as const;

export const ENERGY_DESCRIPTORS = {
  Faible: "low",
  "Modérée": "moderate",
  "Élevée": "high",
} as const;

export type Mood = keyof typeof MOOD_DESCRIPTORS;
export type Energy = keyof typeof ENERGY_DESCRIPTORS;

export const MOODS = Object.keys(MOOD_DESCRIPTORS) as Mood[];
export const ENERGIES = Object.keys(ENERGY_DESCRIPTORS) as Energy[];

export const DURATIONS = [15, 30, 60] as const;
export type DurationSeconds = (typeof DURATIONS)[number];

export const PROMPT_MAX_LENGTH = 500;

export function isMood(value: unknown): value is Mood {
  return typeof value === "string" && (MOODS as string[]).includes(value);
}

export function isEnergy(value: unknown): value is Energy {
  return typeof value === "string" && (ENERGIES as string[]).includes(value);
}

export function isDuration(value: unknown): value is DurationSeconds {
  return typeof value === "number" && (DURATIONS as readonly number[]).includes(value);
}
